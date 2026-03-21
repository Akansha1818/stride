from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from biomechanics import (
    StreamProcessingError,
    calculate_metrics,
    extract_pose_landmarks_from_url,
)
from movement_engine import movement_engine

app = FastAPI(title="Stride CV Service")


class AnalyzeRequest(BaseModel):
    video_url: str
    video_id: str
    user_id: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze_video(req: AnalyzeRequest):
    try:
        print("[Stride CV] New analysis request")
        print("[Stride CV] Video URL:", req.video_url)

        decode_result = await run_in_threadpool(extract_pose_landmarks_from_url, req.video_url)
        frames = decode_result.frames
        fps = decode_result.fps
        total_frames = decode_result.total_frames

        print("[Stride CV] Decoder:", decode_result.decoder)
        print("[Stride CV] Frames:", total_frames)
        print("[Stride CV] Valid frames:", len(frames))

        if not frames:
            return {
                "success": False,
                "video_id": req.video_id,
                "metrics": {},
                "movements": [],
                "error": "No pose detected",
            }

        metrics = calculate_metrics(frames, fps, total_frames)
        movements = movement_engine(metrics, frames)

        print("[Stride CV] Analysis complete")

        return {
            "success": True,
            "video_id": req.video_id,
            "metrics": metrics,
            "movements": movements,
            "stats": {
                "decoder": decode_result.decoder,
                "fps": round(fps, 2),
                "frames_received": total_frames,
                "frames_with_pose": len(frames),
            },
        }

    except StreamProcessingError as exc:
        print("[Stride CV] Stream error:", str(exc))
        raise HTTPException(status_code=502, detail=str(exc))

    except HTTPException as exc:
        print("[Stride CV] HTTP error:", exc.detail)
        raise exc

    except Exception as exc:
        print("[Stride CV] Error:", str(exc))
        raise HTTPException(status_code=500, detail=str(exc))
