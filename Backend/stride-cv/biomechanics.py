import io
import json
import os
import subprocess
from dataclasses import dataclass
from typing import Generator, Iterable, Optional, Tuple

import av
import cv2
import mediapipe as mp
import numpy as np
import requests
from requests.adapters import HTTPAdapter
from scipy.signal import savgol_filter, welch
from urllib3.util.retry import Retry

mp_pose = mp.solutions.pose

LM = {
    "left_shoulder": 11,
    "right_shoulder": 12,
    "left_elbow": 13,
    "right_elbow": 14,
    "left_wrist": 15,
    "right_wrist": 16,
    "left_hip": 23,
    "right_hip": 24,
    "left_knee": 25,
    "right_knee": 26,
    "left_ankle": 27,
    "right_ankle": 28,
}

COM_WEIGHTS = {
    "left_shoulder": 0.15,
    "right_shoulder": 0.15,
    "left_hip": 0.35,
    "right_hip": 0.35,
}

REQUEST_CONNECT_TIMEOUT_SECONDS = float(os.getenv("VIDEO_STREAM_CONNECT_TIMEOUT_SECONDS", "15"))
REQUEST_READ_TIMEOUT_SECONDS = float(os.getenv("VIDEO_STREAM_READ_TIMEOUT_SECONDS", "120"))
STREAM_CHUNK_SIZE = int(os.getenv("VIDEO_STREAM_CHUNK_SIZE", str(1024 * 1024)))
STREAM_MAX_RETRIES = int(os.getenv("VIDEO_STREAM_MAX_RETRIES", "3"))
FRAME_SKIP = max(0, int(os.getenv("VIDEO_FRAME_SKIP", "0")))
FFMPEG_BINARY = os.getenv("FFMPEG_BINARY", "ffmpeg")
FFPROBE_BINARY = os.getenv("FFPROBE_BINARY", "ffprobe")
POSE_VISIBILITY_THRESHOLD = float(os.getenv("POSE_VISIBILITY_THRESHOLD", "0.5"))
SMOOTHING_WINDOW = max(5, int(os.getenv("POSE_SMOOTHING_WINDOW", "11")))
SMOOTHING_POLY_ORDER = max(2, int(os.getenv("POSE_SMOOTHING_POLY_ORDER", "3")))
ASYMMETRY_Z_THRESHOLD = float(os.getenv("POSE_ASYMMETRY_Z_THRESHOLD", "1.0"))


class StreamProcessingError(RuntimeError):
    """Raised when a remote video stream cannot be decoded."""


@dataclass
class StreamDecodeResult:
    frames: list
    fps: float
    total_frames: int
    decoder: str


class ResponseStream(io.RawIOBase):
    """Adapt requests streaming responses to a file-like object PyAV can consume."""

    def __init__(self, response: requests.Response, chunk_size: int = STREAM_CHUNK_SIZE):
        self._response = response
        self._iterator = response.iter_content(chunk_size=chunk_size)
        self._buffer = bytearray()
        self._closed = False

    def readable(self) -> bool:
        return True

    @property
    def closed(self) -> bool:
        return self._closed

    def read(self, size: int = -1) -> bytes:
        if self._closed:
            return b""

        if size == 0:
            return b""

        if size < 0:
            for chunk in self._iterator:
                if chunk:
                    self._buffer.extend(chunk)

            data = bytes(self._buffer)
            self._buffer.clear()
            return data

        while len(self._buffer) < size:
            try:
                chunk = next(self._iterator)
            except StopIteration:
                break

            if chunk:
                self._buffer.extend(chunk)

        data = bytes(self._buffer[:size])
        del self._buffer[:size]
        return data

    def close(self) -> None:
        if not self._closed:
            self._closed = True
            self._response.close()
        super().close()


@dataclass
class MotionSignals:
    frame_indices: np.ndarray
    fps: float
    total_frames: int
    joint_angles: dict
    angular_velocity: dict
    angular_acceleration: dict
    angular_jerk: dict
    com: dict
    trunk: dict
    symmetry: dict
    stability: dict


def _build_retry_session() -> requests.Session:
    retry = Retry(
        total=STREAM_MAX_RETRIES,
        connect=STREAM_MAX_RETRIES,
        read=STREAM_MAX_RETRIES,
        backoff_factor=1.0,
        allowed_methods=frozenset(["GET", "HEAD"]),
        status_forcelist=[408, 429, 500, 502, 503, 504],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=8, pool_maxsize=8)
    session = requests.Session()
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


def _safe_fps(video_stream: av.video.stream.VideoStream) -> float:
    average_rate = video_stream.average_rate or video_stream.base_rate
    if average_rate:
        return float(average_rate)
    return 30.0


def _estimate_total_frames(video_stream: av.video.stream.VideoStream, fps: float) -> int:
    if video_stream.frames:
        return int(video_stream.frames)

    if video_stream.duration and video_stream.time_base:
        duration_seconds = float(video_stream.duration * video_stream.time_base)
        return max(0, int(duration_seconds * fps))

    return 0


def _probe_ffmpeg_stream(video_url: str) -> Tuple[int, int, float, int]:
    probe_command = [
        FFPROBE_BINARY,
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,avg_frame_rate,nb_frames,duration",
        "-of",
        "json",
        video_url,
    ]

    try:
        completed = subprocess.run(
            probe_command,
            check=True,
            capture_output=True,
            text=True,
        )
        payload = json.loads(completed.stdout)
        stream = payload["streams"][0]
    except (subprocess.CalledProcessError, FileNotFoundError, KeyError, IndexError, json.JSONDecodeError) as exc:
        raise StreamProcessingError(f"ffprobe failed to inspect the video stream: {exc}") from exc

    width = int(stream.get("width") or 0)
    height = int(stream.get("height") or 0)

    if width <= 0 or height <= 0:
        raise StreamProcessingError("ffprobe could not determine stream dimensions.")

    avg_frame_rate = stream.get("avg_frame_rate") or "0/1"
    numerator, denominator = avg_frame_rate.split("/")
    fps = float(numerator) / float(denominator) if float(denominator) else 30.0

    nb_frames = stream.get("nb_frames")
    duration = float(stream.get("duration") or 0)
    total_frames = int(nb_frames) if nb_frames and str(nb_frames).isdigit() else int(duration * fps) if duration else 0

    return width, height, fps or 30.0, total_frames


def _iter_frames_with_pyav(video_url: str) -> Generator[Tuple[np.ndarray, float, int], None, None]:
    session = _build_retry_session()
    response = None
    stream = None
    container = None

    try:
        response = session.get(
            video_url,
            stream=True,
            timeout=(REQUEST_CONNECT_TIMEOUT_SECONDS, REQUEST_READ_TIMEOUT_SECONDS),
        )
        response.raise_for_status()
        stream = ResponseStream(response)
        container = av.open(stream, mode="r", timeout=None)
        video_stream = container.streams.video[0]
        fps = _safe_fps(video_stream)
        total_frames = _estimate_total_frames(video_stream, fps)

        for decoded_index, frame in enumerate(container.decode(video=0)):
            if FRAME_SKIP and decoded_index % (FRAME_SKIP + 1) != 0:
                continue

            yield frame.to_ndarray(format="bgr24"), fps, total_frames

    except (requests.RequestException, av.AVError, ValueError, IndexError) as exc:
        raise StreamProcessingError(f"PyAV streaming failed: {exc}") from exc
    finally:
        if container is not None:
            container.close()
        if stream is not None:
            stream.close()
        elif response is not None:
            response.close()
        session.close()


def _iter_frames_with_ffmpeg(video_url: str) -> Generator[Tuple[np.ndarray, float, int], None, None]:
    width, height, fps, total_frames = _probe_ffmpeg_stream(video_url)
    frame_size = width * height * 3
    ffmpeg_command = [
        FFMPEG_BINARY,
        "-hide_banner",
        "-loglevel",
        "error",
        "-reconnect",
        "1",
        "-reconnect_streamed",
        "1",
        "-reconnect_delay_max",
        "5",
        "-i",
        video_url,
        "-an",
        "-sn",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "bgr24",
        "pipe:1",
    ]

    try:
        process = subprocess.Popen(
            ffmpeg_command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=frame_size * 2,
        )
    except FileNotFoundError as exc:
        raise StreamProcessingError("ffmpeg binary not found for fallback decoding.") from exc

    try:
        decoded_index = 0
        while True:
            raw_frame = process.stdout.read(frame_size)
            if len(raw_frame) < frame_size:
                break

            if FRAME_SKIP and decoded_index % (FRAME_SKIP + 1) != 0:
                decoded_index += 1
                continue

            frame = np.frombuffer(raw_frame, dtype=np.uint8).reshape((height, width, 3))
            yield frame, fps, total_frames
            decoded_index += 1

        process.wait(timeout=15)
        if process.returncode not in (0, None):
            stderr = process.stderr.read().decode("utf-8", errors="ignore").strip()
            raise StreamProcessingError(f"ffmpeg fallback failed: {stderr or 'unknown ffmpeg error'}")
    finally:
        if process.stdout:
            process.stdout.close()
        if process.stderr:
            process.stderr.close()
        if process.poll() is None:
            process.kill()
            process.wait()


def _collect_pose_landmarks(frame_stream: Iterable[Tuple[np.ndarray, float, int]], decoder_name: str) -> StreamDecodeResult:
    frames = []
    fps = 30.0
    total_frames = 0

    with mp_pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        smooth_landmarks=True,
    ) as pose:
        for frame, fps, total_frames in frame_stream:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(rgb_frame)

            if not results.pose_landmarks:
                continue

            lm_list = []
            for landmark in results.pose_landmarks.landmark:
                lm_list.append(
                    {
                        "x": landmark.x,
                        "y": landmark.y,
                        "z": landmark.z,
                        "v": landmark.visibility,
                    }
                )
            frames.append(lm_list)

    return StreamDecodeResult(
        frames=frames,
        fps=fps,
        total_frames=total_frames,
        decoder=decoder_name,
    )


def extract_pose_landmarks_from_url(video_url: str) -> StreamDecodeResult:
    pyav_error: Optional[Exception] = None

    try:
        return _collect_pose_landmarks(_iter_frames_with_pyav(video_url), decoder_name="pyav")
    except StreamProcessingError as exc:
        pyav_error = exc
        print(f"[Stride CV] PyAV streaming unavailable, switching to ffmpeg fallback: {exc}")

    try:
        return _collect_pose_landmarks(_iter_frames_with_ffmpeg(video_url), decoder_name="ffmpeg")
    except StreamProcessingError as exc:
        if pyav_error is not None:
            raise StreamProcessingError(
                f"Streaming decode failed for both PyAV and ffmpeg. PyAV error: {pyav_error}. ffmpeg error: {exc}"
            ) from exc
        raise


def _frames_to_array(frames: list) -> np.ndarray:
    if not frames:
        return np.empty((0, 33, 4), dtype=np.float32)

    landmarks = np.array(
        [[[point["x"], point["y"], point["z"], point.get("v", 1.0)] for point in frame] for frame in frames],
        dtype=np.float32,
    )
    return landmarks


def _odd_window(length: int) -> int:
    if length < 5:
        return 0

    window = min(SMOOTHING_WINDOW, length if length % 2 == 1 else length - 1)
    if window <= SMOOTHING_POLY_ORDER:
        window = SMOOTHING_POLY_ORDER + 2 if (SMOOTHING_POLY_ORDER + 2) % 2 == 1 else SMOOTHING_POLY_ORDER + 3
    if window > length:
        window = length if length % 2 == 1 else length - 1
    return window if window >= 5 else 0


def _interpolate_nan_series(series: np.ndarray) -> np.ndarray:
    series = np.asarray(series, dtype=np.float32)
    if series.size == 0:
        return series

    result = series.copy()
    valid = np.isfinite(result)
    if not np.any(valid):
        return np.full_like(result, np.nan, dtype=np.float32)

    indices = np.arange(result.size)
    result[~valid] = np.interp(indices[~valid], indices[valid], result[valid])
    return result


def _smooth_series(series: np.ndarray) -> np.ndarray:
    if series.size == 0:
        return series

    interpolated = _interpolate_nan_series(series)
    valid = np.isfinite(interpolated)
    if not np.any(valid):
        return interpolated

    window = _odd_window(interpolated.size)
    if window:
        return savgol_filter(interpolated, window_length=window, polyorder=min(SMOOTHING_POLY_ORDER, window - 1), mode="interp")
    return interpolated


def _landmark_xy(landmarks: np.ndarray, key: str) -> np.ndarray:
    index = LM[key]
    xy = landmarks[:, index, :2].copy()
    visibility = landmarks[:, index, 3]
    xy[visibility < POSE_VISIBILITY_THRESHOLD] = np.nan
    return xy


def _point_visibility(landmarks: np.ndarray, key: str) -> np.ndarray:
    return landmarks[:, LM[key], 3]


def _smooth_xy(points: np.ndarray) -> np.ndarray:
    if points.size == 0:
        return points

    smoothed = np.empty_like(points, dtype=np.float32)
    for axis in range(points.shape[1]):
        smoothed[:, axis] = _smooth_series(points[:, axis])
    return smoothed


def _calc_angle_series(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> np.ndarray:
    ba = a - b
    bc = c - b
    denom = np.linalg.norm(ba, axis=1) * np.linalg.norm(bc, axis=1)
    numerator = np.sum(ba * bc, axis=1)

    with np.errstate(divide="ignore", invalid="ignore"):
        cosine = np.divide(numerator, denom, out=np.full_like(numerator, np.nan, dtype=np.float32), where=denom > 1e-6)
    cosine = np.clip(cosine, -1.0, 1.0)
    return np.degrees(np.arccos(cosine))


def _derivative(series: np.ndarray, fps: float) -> np.ndarray:
    if series.size == 0:
        return series
    return np.gradient(series) * fps


def _summary_stats(series: np.ndarray) -> dict:
    valid = series[np.isfinite(series)]
    if valid.size == 0:
        return {
            "mean": None,
            "min": None,
            "max": None,
            "std": None,
            "rom": None,
        }

    return {
        "mean": round(float(np.mean(valid)), 2),
        "min": round(float(np.min(valid)), 2),
        "max": round(float(np.max(valid)), 2),
        "std": round(float(np.std(valid)), 2),
        "rom": round(float(np.max(valid) - np.min(valid)), 2),
    }


def _series_energy(series: np.ndarray) -> float:
    valid = series[np.isfinite(series)]
    return float(np.mean(np.square(valid))) if valid.size else 0.0


def _nan_corr(a: np.ndarray, b: np.ndarray) -> Optional[float]:
    mask = np.isfinite(a) & np.isfinite(b)
    if np.sum(mask) < 3:
        return None
    a_valid = a[mask]
    b_valid = b[mask]
    if np.std(a_valid) < 1e-6 or np.std(b_valid) < 1e-6:
        return None
    return float(np.corrcoef(a_valid, b_valid)[0, 1])


def _detect_asymmetry_phases(left: np.ndarray, right: np.ndarray, fps: float) -> list:
    diff = left - right
    diff = diff[np.isfinite(diff)] if diff.size else diff
    if diff.size < 5:
        return []

    full_diff = left - right
    smoothed_diff = _smooth_series(full_diff)
    valid = np.isfinite(smoothed_diff)
    if np.sum(valid) < 5:
        return []

    z_scores = np.zeros_like(smoothed_diff)
    valid_diff = smoothed_diff[valid]
    scale = np.std(valid_diff)
    if scale < 1e-6:
        return []

    z_scores[valid] = (valid_diff - np.mean(valid_diff)) / scale
    mask = np.abs(z_scores) >= ASYMMETRY_Z_THRESHOLD
    phases = []
    start = None

    for index, flagged in enumerate(mask):
        if flagged and start is None:
            start = index
        elif not flagged and start is not None:
            if index - start >= max(3, int(0.1 * fps)):
                phases.append({
                    "start_frame": int(start),
                    "end_frame": int(index - 1),
                    "duration_frames": int(index - start),
                })
            start = None

    if start is not None:
        end = len(mask) - 1
        if end - start + 1 >= max(3, int(0.1 * fps)):
            phases.append({
                "start_frame": int(start),
                "end_frame": int(end),
                "duration_frames": int(end - start + 1),
            })

    return phases


def _dominant_frequency(series: np.ndarray, fps: float) -> Optional[float]:
    valid = series[np.isfinite(series)]
    if valid.size < 8 or fps <= 0:
        return None

    frequencies, spectrum = welch(valid, fs=fps, nperseg=min(256, valid.size))
    if frequencies.size < 2 or np.all(spectrum <= 0):
        return None

    dominant_index = int(np.argmax(spectrum[1:]) + 1)
    return round(float(frequencies[dominant_index]), 3)


def build_motion_signals(frames: list, fps: float, total_frames: int) -> MotionSignals:
    landmarks = _frames_to_array(frames)
    frame_count = landmarks.shape[0]

    if frame_count == 0:
        empty = np.array([], dtype=np.float32)
        return MotionSignals(
            frame_indices=np.array([], dtype=np.int32),
            fps=fps,
            total_frames=total_frames,
            joint_angles={},
            angular_velocity={},
            angular_acceleration={},
            angular_jerk={},
            com={},
            trunk={},
            symmetry={},
            stability={},
        )

    points = {name: _smooth_xy(_landmark_xy(landmarks, name)) for name in LM}

    joint_angles = {
        "left_knee": _smooth_series(_calc_angle_series(points["left_hip"], points["left_knee"], points["left_ankle"])),
        "right_knee": _smooth_series(_calc_angle_series(points["right_hip"], points["right_knee"], points["right_ankle"])),
        "left_hip": _smooth_series(_calc_angle_series(points["left_shoulder"], points["left_hip"], points["left_knee"])),
        "right_hip": _smooth_series(_calc_angle_series(points["right_shoulder"], points["right_hip"], points["right_knee"])),
        "left_elbow": _smooth_series(_calc_angle_series(points["left_shoulder"], points["left_elbow"], points["left_wrist"])),
        "right_elbow": _smooth_series(_calc_angle_series(points["right_shoulder"], points["right_elbow"], points["right_wrist"])),
    }

    mid_shoulder = np.nanmean(np.stack([points["left_shoulder"], points["right_shoulder"]], axis=0), axis=0)
    mid_hip = np.nanmean(np.stack([points["left_hip"], points["right_hip"]], axis=0), axis=0)
    vertical_reference = mid_hip + np.array([0.0, -1.0], dtype=np.float32)
    trunk_angle = _smooth_series(_calc_angle_series(mid_shoulder, mid_hip, vertical_reference))

    com_components = []
    total_weight = 0.0
    for key, weight in COM_WEIGHTS.items():
        com_components.append(points[key] * weight)
        total_weight += weight
    com_xy = np.sum(np.stack(com_components, axis=0), axis=0) / max(total_weight, 1e-6)
    com_x = _smooth_series(com_xy[:, 0])
    com_y = _smooth_series(com_xy[:, 1])
    com_speed = np.sqrt(np.square(_derivative(com_x, fps)) + np.square(_derivative(com_y, fps)))
    com_vertical_velocity = _derivative(com_y, fps)
    com_vertical_acceleration = _derivative(com_vertical_velocity, fps)
    com_vertical_jerk = _derivative(com_vertical_acceleration, fps)

    angular_velocity = {name: _derivative(series, fps) for name, series in joint_angles.items()}
    angular_acceleration = {name: _derivative(series, fps) for name, series in angular_velocity.items()}
    angular_jerk = {name: _derivative(series, fps) for name, series in angular_acceleration.items()}

    symmetry = {}
    for base_joint in ("knee", "hip", "elbow"):
        left = joint_angles[f"left_{base_joint}"]
        right = joint_angles[f"right_{base_joint}"]
        diff = left - right
        symmetry[base_joint] = {
            "correlation": _nan_corr(left, right),
            "mean_absolute_difference": round(float(np.nanmean(np.abs(diff))), 3) if np.isfinite(diff).any() else None,
            "asymmetry_phases": _detect_asymmetry_phases(left, right, fps),
        }

    trunk_velocity = _derivative(trunk_angle, fps)
    trunk_frequency = _dominant_frequency(trunk_angle, fps)
    balance_score = max(0.0, 100.0 - float(np.nanstd(com_x) + np.nanstd(com_y)) * 100.0)

    stability = {
        "trunk_sway_std": round(float(np.nanstd(trunk_angle)), 4) if np.isfinite(trunk_angle).any() else None,
        "trunk_sway_frequency_hz": trunk_frequency,
        "balance_score": round(balance_score, 2),
        "com_variance": round(float(np.nanvar(com_x) + np.nanvar(com_y)), 6) if np.isfinite(com_x).any() else None,
    }

    return MotionSignals(
        frame_indices=np.arange(frame_count, dtype=np.int32),
        fps=fps,
        total_frames=total_frames,
        joint_angles=joint_angles,
        angular_velocity=angular_velocity,
        angular_acceleration=angular_acceleration,
        angular_jerk=angular_jerk,
        com={
            "x": com_x,
            "y": com_y,
            "speed": com_speed,
            "velocity_x": _derivative(com_x, fps),
            "velocity_y": com_vertical_velocity,
            "acceleration_x": _derivative(_derivative(com_x, fps), fps),
            "acceleration_y": com_vertical_acceleration,
            "jerk_y": com_vertical_jerk,
            "vertical_displacement": float(np.nanmax(com_y) - np.nanmin(com_y)) if np.isfinite(com_y).any() else 0.0,
        },
        trunk={
            "angle": trunk_angle,
            "velocity": trunk_velocity,
        },
        symmetry=symmetry,
        stability=stability,
    )


def _round_or_none(value: Optional[float], digits: int = 2) -> Optional[float]:
    if value is None or not np.isfinite(value):
        return None
    return round(float(value), digits)


def calculate_metrics(frames, fps, total_frames):
    signals = build_motion_signals(frames, fps, total_frames)

    if signals.frame_indices.size == 0:
        return {
            "joint_angles": {},
            "angular_velocity": {},
            "angular_acceleration": {},
            "com_metrics": {},
            "symmetry_metrics": {},
            "stability_metrics": {},
            "frames_analyzed": 0,
            "total_frames": total_frames,
            "fps": round(fps, 2),
            "duration_seconds": 0,
            "injury_flags": [],
        }

    joint_metrics = {}
    angular_velocity_metrics = {}
    angular_acceleration_metrics = {}
    jerk_metrics = {}

    for joint_name, angle_series in signals.joint_angles.items():
        joint_metrics[joint_name] = {
            **_summary_stats(angle_series),
            "stiffness_proxy": _round_or_none(np.nanvar(angle_series), 4),
        }
        angular_velocity_metrics[joint_name] = {
            **_summary_stats(signals.angular_velocity[joint_name]),
            "energy": _round_or_none(_series_energy(signals.angular_velocity[joint_name]), 4),
        }
        angular_acceleration_metrics[joint_name] = {
            **_summary_stats(signals.angular_acceleration[joint_name]),
            "energy": _round_or_none(_series_energy(signals.angular_acceleration[joint_name]), 4),
        }
        jerk_metrics[joint_name] = {
            **_summary_stats(signals.angular_jerk[joint_name]),
            "smoothness": _round_or_none(_series_energy(signals.angular_jerk[joint_name]), 6),
        }

    com_metrics = {
        "mean_x": _round_or_none(np.nanmean(signals.com["x"]), 4),
        "mean_y": _round_or_none(np.nanmean(signals.com["y"]), 4),
        "vertical_displacement": _round_or_none(signals.com["vertical_displacement"], 4),
        "speed_mean": _round_or_none(np.nanmean(signals.com["speed"]), 4),
        "speed_max": _round_or_none(np.nanmax(signals.com["speed"]), 4),
        "velocity_y_max": _round_or_none(np.nanmax(np.abs(signals.com["velocity_y"])), 4),
        "acceleration_y_max": _round_or_none(np.nanmax(np.abs(signals.com["acceleration_y"])), 4),
        "jerk_y_mean": _round_or_none(np.nanmean(np.abs(signals.com["jerk_y"])), 6),
    }

    symmetry_metrics = signals.symmetry
    stability_metrics = signals.stability

    left_knee_metrics = joint_metrics.get("left_knee", {})
    right_knee_metrics = joint_metrics.get("right_knee", {})
    left_hip_metrics = joint_metrics.get("left_hip", {})
    right_hip_metrics = joint_metrics.get("right_hip", {})
    left_elbow_metrics = joint_metrics.get("left_elbow", {})
    right_elbow_metrics = joint_metrics.get("right_elbow", {})
    knee_corr = symmetry_metrics.get("knee", {}).get("correlation")

    if knee_corr is None:
        knee_symmetry_score = None
    else:
        knee_symmetry_score = round(max(0.0, min(100.0, (knee_corr + 1.0) * 50.0)), 1)

    metrics = {
        "joint_angles": joint_metrics,
        "angular_velocity": angular_velocity_metrics,
        "angular_acceleration": angular_acceleration_metrics,
        "temporal_metrics": {
            "joint_jerk": jerk_metrics,
            "trunk_velocity_mean": _round_or_none(np.nanmean(np.abs(signals.trunk["velocity"])), 4),
            "com_jerk_mean": com_metrics["jerk_y_mean"],
        },
        "com_metrics": com_metrics,
        "symmetry_metrics": symmetry_metrics,
        "stability_metrics": stability_metrics,
        "left_knee_angle_avg": left_knee_metrics.get("mean"),
        "right_knee_angle_avg": right_knee_metrics.get("mean"),
        "left_knee_angle_min": left_knee_metrics.get("min"),
        "right_knee_angle_min": right_knee_metrics.get("min"),
        "left_hip_angle_avg": left_hip_metrics.get("mean"),
        "right_hip_angle_avg": right_hip_metrics.get("mean"),
        "left_elbow_angle_avg": left_elbow_metrics.get("mean"),
        "right_elbow_angle_avg": right_elbow_metrics.get("mean"),
        "trunk_lean_avg": _round_or_none(np.nanmean(signals.trunk["angle"]), 2),
        "trunk_lean_max": _round_or_none(np.nanmax(signals.trunk["angle"]), 2),
        "knee_symmetry_score": knee_symmetry_score,
        "stability_score": stability_metrics.get("balance_score"),
        "com_vertical_std": _round_or_none(np.nanstd(signals.com["y"]), 6),
        "frames_analyzed": len(frames),
        "total_frames": total_frames,
        "fps": round(fps, 2),
        "duration_seconds": round(len(frames) / fps, 2) if fps else None,
        "injury_flags": [],
    }

    return metrics
