import numpy as np
from scipy.signal import find_peaks, savgol_filter

from biomechanics import build_motion_signals

MIN_SEGMENT_FRAMES = 12
ENERGY_PERCENTILE = 65
CONFIDENCE_KEYS = ("squat", "jump", "sprint", "throw", "unknown")


def _safe_array(values):
    array = np.asarray(values, dtype=np.float32)
    return array if array.size else np.array([], dtype=np.float32)


def _smooth_signal(signal, window=11, polyorder=3):
    signal = _safe_array(signal)
    if signal.size < 5:
        return signal

    valid = np.isfinite(signal)
    if not np.any(valid):
        return signal

    indices = np.arange(signal.size)
    interpolated = signal.copy()
    interpolated[~valid] = np.interp(indices[~valid], indices[valid], interpolated[valid])

    window = min(window, signal.size if signal.size % 2 == 1 else signal.size - 1)
    if window <= polyorder:
        window = polyorder + 2 if (polyorder + 2) % 2 == 1 else polyorder + 3
    if window > signal.size:
        window = signal.size if signal.size % 2 == 1 else signal.size - 1

    if window < 5:
        return interpolated

    return savgol_filter(interpolated, window_length=window, polyorder=min(polyorder, window - 1), mode="interp")


def _normalize_signal(signal):
    signal = _safe_array(signal)
    if signal.size == 0:
        return signal

    mean = np.nanmean(signal)
    std = np.nanstd(signal)
    if not np.isfinite(std) or std < 1e-6:
        return np.zeros_like(signal)

    return (signal - mean) / std


def _safe_slice(signal, start, end):
    signal = _safe_array(signal)
    start = max(0, int(start))
    end = min(signal.size - 1, int(end))
    if signal.size == 0 or end < start:
        return np.array([], dtype=np.float32)
    return signal[start : end + 1]


def _zero_crossings(signal):
    signal = _safe_array(signal)
    if signal.size < 2:
        return np.array([], dtype=np.int32)
    return np.where(np.signbit(signal[:-1]) != np.signbit(signal[1:]))[0] + 1


def _segment_signal(energy_signal, velocity_signal):
    energy = _smooth_signal(energy_signal)
    velocity = _smooth_signal(velocity_signal)

    if energy.size == 0:
        return []

    energy_threshold = float(np.nanpercentile(energy, ENERGY_PERCENTILE)) if np.isfinite(energy).any() else 0.0
    active_mask = energy >= energy_threshold

    peaks, _ = find_peaks(energy, prominence=max(np.nanstd(energy), 0.05), distance=max(4, MIN_SEGMENT_FRAMES // 2))
    zero_crossings = _zero_crossings(velocity)

    segments = []
    cursor = 0
    while cursor < active_mask.size:
        if not active_mask[cursor]:
            cursor += 1
            continue

        start = cursor
        while cursor < active_mask.size and active_mask[cursor]:
            cursor += 1
        end = cursor - 1

        if end - start + 1 < MIN_SEGMENT_FRAMES:
            continue

        local_peaks = peaks[(peaks >= start) & (peaks <= end)]
        if local_peaks.size:
            start_candidates = zero_crossings[zero_crossings <= local_peaks[0]]
            end_candidates = zero_crossings[zero_crossings >= local_peaks[-1]]
            if start_candidates.size:
                start = max(0, int(start_candidates[-1]))
            if end_candidates.size:
                end = min(active_mask.size - 1, int(end_candidates[0]))

        if end - start + 1 >= MIN_SEGMENT_FRAMES:
            segments.append((int(start), int(end)))

    if not segments and energy.size >= MIN_SEGMENT_FRAMES:
        segments.append((0, int(energy.size - 1)))

    merged_segments = []
    for segment in segments:
        if not merged_segments:
            merged_segments.append(segment)
            continue

        previous_start, previous_end = merged_segments[-1]
        current_start, current_end = segment
        if current_start - previous_end <= max(3, MIN_SEGMENT_FRAMES // 3):
            merged_segments[-1] = (previous_start, current_end)
        else:
            merged_segments.append(segment)

    return merged_segments


def _score_movement(features):
    scores = {name: 0.0 for name in CONFIDENCE_KEYS}

    knee_min = features["knee_min"]
    knee_rom = features["knee_rom"]
    com_vertical = features["com_vertical_displacement"]
    trunk_mean = features["trunk_mean"]
    trunk_velocity = features["trunk_velocity_max"]
    elbow_rom = features["elbow_rom"]
    horizontal_speed = features["horizontal_speed_mean"]

    scores["squat"] += np.clip((140 - knee_min) / 35, 0, 1) * 0.4
    scores["squat"] += np.clip(knee_rom / 70, 0, 1) * 0.35
    scores["squat"] += np.clip((18 - trunk_mean) / 18, 0, 1) * 0.25

    scores["jump"] += np.clip(com_vertical / 0.14, 0, 1) * 0.35
    scores["jump"] += np.clip(knee_rom / 65, 0, 1) * 0.25
    scores["jump"] += np.clip(features["vertical_velocity_max"] / 1.2, 0, 1) * 0.25
    scores["jump"] += np.clip((150 - knee_min) / 45, 0, 1) * 0.15

    scores["sprint"] += np.clip(horizontal_speed / 0.08, 0, 1) * 0.35
    scores["sprint"] += np.clip(trunk_mean / 20, 0, 1) * 0.2
    scores["sprint"] += np.clip(trunk_velocity / 150, 0, 1) * 0.2
    scores["sprint"] += np.clip(features["step_frequency"] / 4.5, 0, 1) * 0.25

    scores["throw"] += np.clip(elbow_rom / 70, 0, 1) * 0.35
    scores["throw"] += np.clip(features["elbow_velocity_max"] / 250, 0, 1) * 0.3
    scores["throw"] += np.clip(trunk_velocity / 120, 0, 1) * 0.2
    scores["throw"] += np.clip(horizontal_speed / 0.05, 0, 1) * 0.15

    best_label = max((label for label in scores if label != "unknown"), key=lambda label: scores[label])
    best_score = scores[best_label]
    scores["unknown"] = max(0.0, 1.0 - best_score)

    if best_score < 0.35:
        return "unknown", round(scores["unknown"], 2), scores

    return best_label, round(min(best_score, 0.99), 2), scores


def _phase_frame(segment_start, local_index):
    if local_index is None:
        return None
    return int(segment_start + local_index)


def _detect_jump_phases(segment_start, com_velocity, knee_signal, com_position):
    if com_velocity.size < 4:
        return {}

    crouch = int(np.nanargmin(knee_signal)) if knee_signal.size else None
    takeoff = int(np.nanargmax(com_velocity))
    landing = int(np.nanargmin(com_velocity))

    flight_start_candidates = _zero_crossings(com_velocity[takeoff:])
    flight = takeoff + int(flight_start_candidates[0]) if flight_start_candidates.size else takeoff

    return {
        "crouch": {"frame": _phase_frame(segment_start, crouch)},
        "takeoff": {"frame": _phase_frame(segment_start, takeoff)},
        "flight": {"frame": _phase_frame(segment_start, flight)},
        "landing": {"frame": _phase_frame(segment_start, landing)},
    }


def _detect_sprint_phases(segment_start, horizontal_velocity):
    if horizontal_velocity.size < 4:
        return {}

    stance = int(np.nanargmax(np.abs(horizontal_velocity)))
    zero_crossings = _zero_crossings(horizontal_velocity)
    swing = int(zero_crossings[0]) if zero_crossings.size else stance

    return {
        "stance": {"frame": _phase_frame(segment_start, stance)},
        "swing": {"frame": _phase_frame(segment_start, swing)},
    }


def _detect_throw_phases(segment_start, elbow_velocity):
    if elbow_velocity.size < 4:
        return {}

    load = int(np.nanargmin(elbow_velocity))
    acceleration = int(np.nanargmax(np.gradient(elbow_velocity))) if elbow_velocity.size > 2 else load
    release = int(np.nanargmax(elbow_velocity))
    follow_through = min(elbow_velocity.size - 1, release + max(1, elbow_velocity.size // 6))

    return {
        "load": {"frame": _phase_frame(segment_start, load)},
        "acceleration": {"frame": _phase_frame(segment_start, acceleration)},
        "release": {"frame": _phase_frame(segment_start, release)},
        "follow_through": {"frame": _phase_frame(segment_start, follow_through)},
    }


def _detect_squat_phases(segment_start, knee_signal, com_velocity):
    if knee_signal.size < 4:
        return {}

    descent_start = int(_zero_crossings(com_velocity)[0]) if _zero_crossings(com_velocity).size else 0
    bottom = int(np.nanargmin(knee_signal))
    ascent = int(np.nanargmax(com_velocity))

    return {
        "descent": {"frame": _phase_frame(segment_start, descent_start)},
        "bottom": {"frame": _phase_frame(segment_start, bottom)},
        "ascent": {"frame": _phase_frame(segment_start, ascent)},
    }


def _detect_phases(movement, segment_start, segment_signals):
    if movement == "jump":
        return _detect_jump_phases(
            segment_start,
            segment_signals["com_velocity_y"],
            segment_signals["knee"],
            segment_signals["com_y"],
        )
    if movement == "sprint":
        return _detect_sprint_phases(segment_start, segment_signals["com_velocity_x"])
    if movement == "throw":
        return _detect_throw_phases(segment_start, segment_signals["elbow_velocity"])
    if movement == "squat":
        return _detect_squat_phases(segment_start, segment_signals["knee"], segment_signals["com_velocity_y"])
    return {}


def _segment_features(segment_signals, fps):
    knee = segment_signals["knee"]
    elbow = segment_signals["elbow"]
    trunk = segment_signals["trunk"]
    com_y = segment_signals["com_y"]
    com_velocity_y = segment_signals["com_velocity_y"]
    com_velocity_x = segment_signals["com_velocity_x"]
    elbow_velocity = segment_signals["elbow_velocity"]

    step_peaks, _ = find_peaks(np.abs(com_velocity_x), distance=max(3, int(fps * 0.12))) if com_velocity_x.size else (np.array([]), {})

    return {
        "knee_min": float(np.nanmin(knee)) if knee.size else 180.0,
        "knee_rom": float(np.nanmax(knee) - np.nanmin(knee)) if knee.size else 0.0,
        "elbow_rom": float(np.nanmax(elbow) - np.nanmin(elbow)) if elbow.size else 0.0,
        "trunk_mean": float(np.nanmean(np.abs(trunk))) if trunk.size else 0.0,
        "trunk_velocity_max": float(np.nanmax(np.abs(np.gradient(trunk) * fps))) if trunk.size > 1 else 0.0,
        "com_vertical_displacement": float(np.nanmax(com_y) - np.nanmin(com_y)) if com_y.size else 0.0,
        "vertical_velocity_max": float(np.nanmax(np.abs(com_velocity_y))) if com_velocity_y.size else 0.0,
        "horizontal_speed_mean": float(np.nanmean(np.abs(com_velocity_x))) if com_velocity_x.size else 0.0,
        "elbow_velocity_max": float(np.nanmax(np.abs(elbow_velocity))) if elbow_velocity.size else 0.0,
        "step_frequency": float(step_peaks.size / max(knee.size / fps, 1e-6)) if knee.size and fps else 0.0,
    }


def _extract_segment_signals(signals, start, end):
    return {
        "knee": _safe_slice((signals.joint_angles["left_knee"] + signals.joint_angles["right_knee"]) / 2, start, end),
        "elbow": _safe_slice((signals.joint_angles["left_elbow"] + signals.joint_angles["right_elbow"]) / 2, start, end),
        "trunk": _safe_slice(signals.trunk["angle"], start, end),
        "com_y": _safe_slice(signals.com["y"], start, end),
        "com_velocity_y": _safe_slice(signals.com["velocity_y"], start, end),
        "com_velocity_x": _safe_slice(signals.com["velocity_x"], start, end),
        "elbow_velocity": _safe_slice((signals.angular_velocity["left_elbow"] + signals.angular_velocity["right_elbow"]) / 2, start, end),
    }


def movement_engine(metrics, frames):
    fps = metrics.get("fps") or 30.0
    total_frames = metrics.get("total_frames") or len(frames)
    signals = build_motion_signals(frames, fps, total_frames)

    if signals.frame_indices.size == 0:
        return []

    knee_signal = _smooth_signal((signals.joint_angles["left_knee"] + signals.joint_angles["right_knee"]) / 2)
    energy_signal = _smooth_signal(np.abs(signals.com["velocity_y"]) + np.abs(signals.com["velocity_x"]))
    velocity_signal = _smooth_signal(signals.com["velocity_y"])

    segments = _segment_signal(_normalize_signal(energy_signal), _normalize_signal(velocity_signal))
    movements = []

    for start, end in segments:
        if end <= start:
            continue

        segment_signals = _extract_segment_signals(signals, start, end)
        if segment_signals["knee"].size < MIN_SEGMENT_FRAMES:
            continue

        features = _segment_features(segment_signals, signals.fps)
        movement, confidence, score_breakdown = _score_movement(features)
        phases = _detect_phases(movement, start, segment_signals)

        movements.append(
            {
                "movement": movement,
                "confidence": confidence,
                "segment": [int(start), int(end)],
                "phases": phases,
                "metrics": {
                    **{key: round(float(value), 4) for key, value in features.items()},
                    "score_breakdown": {label: round(float(score), 4) for label, score in score_breakdown.items()},
                    "start_seconds": round(start / signals.fps, 3) if signals.fps else None,
                    "end_seconds": round(end / signals.fps, 3) if signals.fps else None,
                },
            }
        )

    if not movements:
        features = _segment_features(_extract_segment_signals(signals, 0, signals.frame_indices.size - 1), signals.fps)
        movement, confidence, score_breakdown = _score_movement(features)
        movements.append(
            {
                "movement": movement,
                "confidence": confidence,
                "segment": [0, int(signals.frame_indices.size - 1)],
                "phases": {},
                "metrics": {
                    **{key: round(float(value), 4) for key, value in features.items()},
                    "score_breakdown": {label: round(float(score), 4) for label, score in score_breakdown.items()},
                    "start_seconds": 0.0,
                    "end_seconds": round((signals.frame_indices.size - 1) / signals.fps, 3) if signals.fps else None,
                },
            }
        )

    return movements
