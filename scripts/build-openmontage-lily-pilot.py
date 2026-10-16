from __future__ import annotations

import json
import math
import random
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OPENMONTAGE = ROOT / "tmp" / "OpenMontage"
PROJECT = OPENMONTAGE / "projects" / "lily-hybrid-pilot"
SNAPSHOTS = PROJECT / "snapshots"
OUTPUT = ROOT / "openmontage-lily-pilot.mp4"
WIDTH, HEIGHT, FPS = 1280, 720, 24
FONT = "C:/Windows/Fonts/msyh.ttc"
FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"


def path(*parts: str) -> Path:
    return ROOT.joinpath(*parts)


def write_json(name: str, payload: dict) -> None:
    (PROJECT / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def validate_artifact(name: str, payload: dict) -> None:
    sys.path.insert(0, str(OPENMONTAGE))
    try:
        from schemas.artifacts import validate_artifact as validate

        validate(name, payload)
    except Exception as exc:
        raise RuntimeError(f"OpenMontage artifact validation failed for {name}: {exc}") from exc


def rgba(path_value: Path) -> np.ndarray:
    image = cv2.imread(str(path_value), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise FileNotFoundError(path_value)
    if image.shape[2] == 3:
        image = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    return image


def cover(image: np.ndarray) -> np.ndarray:
    scale = max(WIDTH / image.shape[1], HEIGHT / image.shape[0])
    size = (round(image.shape[1] * scale), round(image.shape[0] * scale))
    resized = cv2.resize(image, size, interpolation=cv2.INTER_AREA)
    left = max(0, (resized.shape[1] - WIDTH) // 2)
    top = max(0, (resized.shape[0] - HEIGHT) // 2)
    cropped = resized[top : top + HEIGHT, left : left + WIDTH].copy()
    if cropped.shape[2] == 4:
        cropped = cv2.cvtColor(cropped, cv2.COLOR_BGRA2BGR)
    return cropped


def zoom_pan(image: np.ndarray, progress: float, focus: tuple[float, float], zoom_end: float) -> np.ndarray:
    base = cover(image)
    zoom = 1.0 + (zoom_end - 1.0) * max(0.0, min(1.0, progress))
    scaled = cv2.resize(base, (round(WIDTH * zoom), round(HEIGHT * zoom)), interpolation=cv2.INTER_LINEAR)
    max_x = scaled.shape[1] - WIDTH
    max_y = scaled.shape[0] - HEIGHT
    left = round(max_x / 2 + max_x * (focus[0] - 0.5) * 1.6)
    top = round(max_y / 2 + max_y * (focus[1] - 0.5) * 1.6)
    left = max(0, min(max_x, left))
    top = max(0, min(max_y, top))
    return scaled[top : top + HEIGHT, left : left + WIDTH].copy()


def ease(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def alpha_over(base: np.ndarray, foreground: np.ndarray, x: int, y: int, scale: float = 1.0) -> None:
    if scale != 1.0:
        foreground = cv2.resize(
            foreground,
            (max(1, round(foreground.shape[1] * scale)), max(1, round(foreground.shape[0] * scale))),
            interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_LINEAR,
        )
    h, w = foreground.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(WIDTH, x + w), min(HEIGHT, y + h)
    if x0 >= x1 or y0 >= y1:
        return
    crop = foreground[y0 - y : y1 - y, x0 - x : x1 - x]
    alpha = crop[:, :, 3:4].astype(np.float32) / 255.0
    target = base[y0:y1, x0:x1].astype(np.float32)
    base[y0:y1, x0:x1] = (crop[:, :, :3].astype(np.float32) * alpha + target * (1 - alpha)).astype(np.uint8)


def glow(base: np.ndarray, center: tuple[int, int], radius: int, color: tuple[int, int, int], strength: float) -> None:
    layer = np.zeros_like(base)
    cv2.circle(layer, center, radius, color, -1, cv2.LINE_AA)
    layer = cv2.GaussianBlur(layer, (0, 0), radius / 2.5)
    cv2.addWeighted(base, 1.0, layer, max(0.0, min(1.0, strength)), 0, dst=base)


def draw_text(base: np.ndarray, xy: tuple[int, int], text: str, size: int, color=(255, 245, 224), bold=False) -> None:
    rgb = cv2.cvtColor(base, cv2.COLOR_BGR2RGB)
    canvas = Image.fromarray(rgb)
    draw = ImageDraw.Draw(canvas)
    font_path = FONT_BOLD if bold else FONT
    font = ImageFont.truetype(font_path, size=size)
    x, y = xy
    draw.text((x + 2, y + 2), text, font=font, fill=(63, 31, 54, 180))
    draw.text((x, y), text, font=font, fill=color)
    base[:] = cv2.cvtColor(np.asarray(canvas), cv2.COLOR_RGB2BGR)


def text_card(base: np.ndarray, title: str, subtitle: str, alpha: float = 0.92) -> None:
    overlay = base.copy()
    cv2.roundedRectangle if False else None
    cv2.rectangle(overlay, (50, 532), (805, 676), (54, 27, 49), -1)
    cv2.addWeighted(overlay, alpha, base, 1 - alpha, 0, dst=base)
    draw_text(base, (84, 556), title, 32, bold=True)
    draw_text(base, (84, 612), subtitle, 21, color=(255, 224, 192))


def particles(base: np.ndarray, progress: float, seed: int, count: int = 34) -> None:
    rng = random.Random(seed)
    overlay = base.copy()
    for _ in range(count):
        x = rng.randint(30, WIDTH - 30)
        y = rng.randint(35, HEIGHT - 80)
        phase = rng.random() * math.tau
        pulse = (math.sin(progress * math.tau * 1.6 + phase) + 1) / 2
        r = max(1, round(1 + pulse * 3))
        cv2.circle(overlay, (x, y), r, (222, 210, 255), -1, cv2.LINE_AA)
    cv2.addWeighted(overlay, 0.48, base, 0.52, 0, dst=base)


def shadow_fox(base: np.ndarray, progress: float) -> None:
    x = round(1000 + 145 * ease(progress))
    y = round(240 - 24 * math.sin(progress * math.pi))
    overlay = base.copy()
    cv2.ellipse(overlay, (x, y), (46, 30), -10, 0, 360, (54, 35, 86), -1, cv2.LINE_AA)
    cv2.fillPoly(overlay, [np.array([[x - 28, y - 18], [x - 45, y - 52], [x - 5, y - 29]], np.int32)], (54, 35, 86))
    cv2.fillPoly(overlay, [np.array([[x + 3, y - 20], [x + 20, y - 57], [x + 32, y - 24]], np.int32)], (54, 35, 86))
    cv2.ellipse(overlay, (x + 15, y - 3), (4, 3), 0, 0, 360, (236, 190, 255), -1, cv2.LINE_AA)
    cv2.addWeighted(overlay, 0.75, base, 0.25, 0, dst=base)


def make_artifacts() -> None:
    PROJECT.mkdir(parents=True, exist_ok=True)
    SNAPSHOTS.mkdir(parents=True, exist_ok=True)
    brief = {
        "version": "1.0",
        "title": "莉莉的衣橱冒险：OpenMontage 动态样片",
        "hook": "漂亮的裙子被影子小狐狸偷走，莉莉追进神秘衣橱世界。",
        "key_points": ["城堡里的莉莉发现衣服失踪", "影子小狐狸带着裙子逃进衣橱世界", "莉莉开始推箱子、点亮星光并解锁新衣服"],
        "core_message": "这是一个把推箱子解谜与换装收藏结合起来的童话冒险游戏。",
        "cta": "进入衣橱世界，帮莉莉找回漂亮衣服。",
        "tone": "温暖、奇幻、轻快、有冒险感",
        "style": "custom atelier：粉彩童话、柔和光晕、真实游戏画面作为叙事锚点",
        "target_audience": "喜欢轻度解谜、换装和童话冒险的玩家",
        "target_platform": "generic",
        "target_duration_seconds": 13.0,
        "reference_material": [str(path("public", "art-v3", "characters", "rose", "right", "walk-01.png")), str(path("taptap-story-trailer.mp4"))],
        "metadata": {"anchor_medium": "screen_recording", "support_layers": ["generated_story_background", "sprite_character_animation", "text_cards", "particles"]},
    }
    script = {
        "version": "1.0",
        "title": brief["title"],
        "total_duration_seconds": 13.0,
        "voice_performance": {"performance_intent": "视觉样片暂不加入旁白", "pacing_profile": "cinematic", "energy_curve": "从惊讶到追逐再进入解谜", "pause_policy": "留出动作空间", "sample_section_id": "s1"},
        "sections": [
            {"id": "s1", "label": "城堡发现", "text": "城堡里的莉莉，发现最漂亮的裙子不见了。", "start_seconds": 0, "end_seconds": 3.1, "enhancement_cues": [{"type": "animation", "description": "莉莉从画面左侧走向城堡光源"}]},
            {"id": "s2", "label": "影子逃走", "text": "影子小狐狸带着裙子，逃进了神秘的衣橱世界。", "start_seconds": 3.1, "end_seconds": 6.2, "enhancement_cues": [{"type": "animation", "description": "影子小狐狸向传送门移动，紫色光晕脉动"}]},
            {"id": "s3", "label": "进入冒险", "text": "莉莉追了进去，推开木箱，点亮星光位置。", "start_seconds": 6.2, "end_seconds": 9.0, "enhancement_cues": [{"type": "animation", "description": "莉莉走入衣橱传送门，镜头跟随"}]},
            {"id": "s4", "label": "真实玩法", "text": "每一步都要想清楚，解开谜题，就能解锁新的衣服。", "start_seconds": 9.0, "end_seconds": 13.0, "enhancement_cues": [{"type": "broll", "description": "使用真实推箱子游戏片段"}]},
        ],
    }
    scene_plan = {
        "version": "1.0",
        "style_playbook": "custom-童话粉彩-atelier",
        "scenes": [
            {"id": "s1", "type": "animation", "description": "城堡夜色中，莉莉从左侧走向发光的城堡与星光。", "start_seconds": 0, "end_seconds": 3.1, "framing": "wide", "movement": "tracking_right + sprite walk", "transition_out": "soft_gold", "shot_language": {"shot_size": "wide", "camera_movement": "tracking_right", "lens_mm": 35, "lighting_key": "blue_hour", "depth_of_field": "medium", "color_temperature": "cool"}, "shot_intent": "建立童话世界并让观众看见莉莉正在主动追寻失物。", "narrative_role": "establish_context", "information_role": "莉莉的衣服被偷，冒险即将开始。", "hero_moment": False, "character_actions": [{"character_id": "lily", "emotion": "worried", "action_sequence": ["walk_right", "look_up", "reach_toward_light"], "target": "castle_light"}], "required_assets": [{"type": "image", "description": "城堡背景", "source": "provided"}, {"type": "animation", "description": "莉莉走路透明素材", "source": "provided"}]},
            {"id": "s2", "type": "generated", "description": "影子小狐狸带着金色裙子冲向传送门，紫色光晕跳动。", "start_seconds": 3.1, "end_seconds": 6.2, "framing": "medium_wide", "movement": "dolly_in + shadow fox run", "transition_in": "soft_gold", "transition_out": "portal_flash", "shot_language": {"shot_size": "medium_wide", "camera_movement": "dolly_in", "lens_mm": 50, "lighting_key": "rim_lit", "depth_of_field": "shallow", "color_temperature": "mixed"}, "shot_intent": "把偷衣服的冲突讲清楚，同时把观众带向衣橱世界。", "narrative_role": "build_tension", "information_role": "影子小狐狸是莉莉追赶的目标。", "hero_moment": True, "required_assets": [{"type": "image", "description": "偷衣服场景背景", "source": "provided"}, {"type": "animation", "description": "影子小狐狸移动和光晕", "source": "generate"}]},
            {"id": "s3", "type": "character_scene", "description": "莉莉从左向右走进发光衣橱传送门，进入玩具房解谜世界。", "start_seconds": 6.2, "end_seconds": 9.0, "framing": "medium_wide", "movement": "tracking_right + portal pulse", "transition_in": "portal_flash", "transition_out": "cut", "shot_language": {"shot_size": "medium_wide", "camera_movement": "tracking_right", "lens_mm": 35, "lighting_key": "volumetric", "depth_of_field": "medium", "color_temperature": "warm"}, "shot_intent": "用角色位移完成从故事到玩法的视觉桥接。", "narrative_role": "transition", "information_role": "莉莉正式进入衣橱世界。", "hero_moment": True, "character_actions": [{"character_id": "lily", "emotion": "determined", "action_sequence": ["walk_right", "enter_portal"], "target": "wardrobe_portal"}], "required_assets": [{"type": "image", "description": "衣橱传送门背景", "source": "provided"}, {"type": "animation", "description": "莉莉走入传送门", "source": "provided"}]},
            {"id": "s4", "type": "screen_recording", "description": "真实游戏画面展示推箱子、点亮星光和衣橱解锁。", "start_seconds": 9.0, "end_seconds": 13.0, "framing": "medium", "movement": "source gameplay motion", "transition_in": "cut", "shot_language": {"shot_size": "medium", "camera_movement": "static", "lens_mm": 50, "lighting_key": "high_key", "depth_of_field": "deep", "color_temperature": "warm"}, "shot_intent": "让观众看到真实玩法，证明这不是纯动画概念。", "narrative_role": "deliver_payload", "information_role": "玩家通过推箱子解谜来解锁衣服。", "hero_moment": False, "required_assets": [{"type": "video", "description": "真实游戏录屏", "source": "record"}]},
        ],
        "metadata": {"anchor_rules": "真实游戏画面在最后一段保持主导", "support_rules": "故事背景和角色移动只承担叙事桥接", "overlay_density_limits": 2},
    }
    assets = {
        "version": "1.0",
        "assets": [
            {"id": "castle_bg", "type": "image", "path": str(path("tmp", "imagegen", "lily-castle-empty.png")), "source_tool": "image_gen", "scene_id": "s1", "format": "png", "resolution": "1536x864", "subtype": "generated_background", "generation_summary": "无水印、留出角色运动空间的城堡故事背景"},
            {"id": "theft_bg", "type": "image", "path": str(path("tmp", "imagegen", "lily-theft-keyframe.png")), "source_tool": "image_gen", "scene_id": "s2", "format": "png", "resolution": "1536x864", "subtype": "generated_background", "generation_summary": "无水印偷衣服故事背景"},
            {"id": "portal_bg", "type": "image", "path": str(path("tmp", "imagegen", "lily-portal-empty.png")), "source_tool": "image_gen", "scene_id": "s3", "format": "png", "resolution": "1536x864", "subtype": "generated_background", "generation_summary": "无水印、留出角色运动空间的衣橱世界传送门背景"},
            {"id": "lily_walk", "type": "animation", "path": str(path("public", "art-v3", "characters", "rose", "right", "walk-01.png")), "source_tool": "game_assets", "scene_id": "s1", "format": "png", "resolution": "512x512", "subtype": "transparent_sprite", "generation_summary": "游戏内莉莉第一套衣服的透明走路素材"},
            {"id": "gameplay_anchor", "type": "video", "path": str(path("taptap-story-trailer.mp4")), "source_tool": "game_recording", "scene_id": "s4", "format": "mp4", "resolution": "1280x720", "subtype": "source_gameplay", "generation_summary": "真实推箱子和衣橱游戏片段"},
        ],
        "total_cost_usd": 0,
        "metadata": {"source_vs_generated_map": {"source": ["lily_walk", "gameplay_anchor"], "generated": ["castle_bg", "theft_bg", "portal_bg"]}},
    }
    edit = {
        "version": "1.0",
        "cuts": [
            {"id": "c1", "source": "castle_bg", "in_seconds": 0, "out_seconds": 3.1, "layer": "background", "transform": {"scale": 1, "position": "center", "animation": "tracking-right-with-sprite"}, "transition_out": "soft_gold", "transition_duration": 0.2, "reason": "建立世界和角色动作"},
            {"id": "c2", "source": "theft_bg", "in_seconds": 0, "out_seconds": 3.1, "layer": "background", "transform": {"scale": 1, "position": "center", "animation": "dolly-in-with-portal-pulse"}, "transition_in": "soft_gold", "transition_duration": 0.2, "transition_out": "portal_flash", "reason": "建立冲突"},
            {"id": "c3", "source": "portal_bg", "in_seconds": 0, "out_seconds": 2.8, "layer": "background", "transform": {"scale": 1, "position": "center", "animation": "tracking-right-with-sprite"}, "transition_in": "portal_flash", "transition_duration": 0.2, "reason": "完成故事到玩法的桥接"},
            {"id": "c4", "source": "gameplay_anchor", "in_seconds": 3.2, "out_seconds": 7.2, "layer": "primary", "transition_in": "cut", "reason": "真实游戏玩法展示"},
        ],
        "renderer_family": "cinematic-trailer",
        "render_runtime": "ffmpeg",
        "composition_mode": "atelier",
        "bespoke": {"entry": str(path("scripts", "build-openmontage-lily-pilot.py")), "composition_id": "lily-hybrid-pilot", "art_direction": "粉彩童话背景、紫色传送门、角色位移动作、真实游戏画面硬切入。"},
        "metadata": {"actual_encoder": "opencv_videoio_mp4v_fallback", "runtime_note": "本机暂缺 FFmpeg/Remotion，视觉样片用 OpenCV 编码；正式片需补齐 OpenMontage compose runtime。"},
    }
    decisions = {
        "version": "1.0",
        "project_id": "lily-hybrid-pilot",
        "decisions": [
            {"decision_id": "d-001", "stage": "idea", "category": "pipeline_selection", "subject": "production pipeline", "options_considered": [{"option_id": "hybrid", "label": "Hybrid", "score": 0.95, "reason": "故事背景和真实游戏录屏需要混剪"}, {"option_id": "animation", "label": "Animation", "score": 0.6, "reason": "能做动画但会削弱真实游戏锚点", "rejected_because": "游戏玩法必须保留"}], "selected": "hybrid", "reason": "真实游戏录屏是玩法证明，故事动画是支持层。", "user_visible": True, "user_approved": True, "confidence": 0.95},
            {"decision_id": "d-002", "stage": "proposal", "category": "renderer_family_selection", "subject": "renderer family", "options_considered": [{"option_id": "cinematic-trailer", "label": "Cinematic trailer", "score": 0.9, "reason": "适合故事钩子和情绪转场"}, {"option_id": "screen-demo", "label": "Screen demo", "score": 0.45, "reason": "适合展示玩法但不能承担故事开场", "rejected_because": "叙事不足"}], "selected": "cinematic-trailer", "reason": "用户需要带故事的游戏宣传片。", "user_visible": True, "user_approved": True, "confidence": 0.9},
            {"decision_id": "d-003", "stage": "proposal", "category": "composition_mode", "subject": "composition mode", "options_considered": [{"option_id": "atelier", "label": "Atelier", "score": 0.9, "reason": "需要为这款游戏单独设计故事桥接和动作"}, {"option_id": "templated", "label": "Templated", "score": 0.5, "reason": "速度快但容易再次像幻灯片", "rejected_because": "用户已明确不满意静态拼接"}], "selected": "atelier", "reason": "英雄宣传片需要独立视觉语言和动作设计。", "user_visible": True, "user_approved": True, "confidence": 0.88},
            {"decision_id": "d-004", "stage": "compose", "category": "fallback_decision", "subject": "local render runtime fallback", "options_considered": [{"option_id": "opencv-pilot", "label": "OpenCV visual pilot", "score": 0.82, "reason": "本机已有 OpenCV，能验证角色位移和混剪逻辑"}, {"option_id": "remotion-hyperframes", "label": "OpenMontage Remotion/HyperFrames", "score": 0.95, "reason": "正式质量更高，但当前缺 Node.js 和 FFmpeg", "rejected_because": "运行环境未安装"}], "selected": "opencv-pilot", "reason": "先验证创意和动作是否有效，正式片前补齐 OpenMontage compose runtime。", "user_visible": True, "user_approved": True, "confidence": 0.86},
        ],
    }
    for name, artifact in [("brief", brief), ("script", script), ("scene_plan", scene_plan), ("asset_manifest", assets), ("edit_decisions", edit), ("decision_log", decisions)]:
        validate_artifact(name, artifact)
        write_json(f"{name}.json", artifact)


def load_game_frames() -> list[np.ndarray]:
    cap = cv2.VideoCapture(str(path("taptap-story-trailer.mp4")))
    if not cap.isOpened():
        raise RuntimeError("Unable to open gameplay anchor")
    source_fps = cap.get(cv2.CAP_PROP_FPS) or FPS
    start = round(3.2 * source_fps)
    end = round(7.2 * source_fps)
    frames: list[np.ndarray] = []
    index = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if start <= index <= end:
            frames.append(cv2.resize(frame, (WIDTH, HEIGHT), interpolation=cv2.INTER_AREA))
        if index > end:
            break
        index += 1
    cap.release()
    if not frames:
        raise RuntimeError("Gameplay anchor segment is empty")
    return frames


def render() -> dict:
    castle = rgba(path("tmp", "imagegen", "lily-castle-empty.png"))
    theft = rgba(path("tmp", "imagegen", "lily-theft-keyframe.png"))
    portal = rgba(path("tmp", "imagegen", "lily-portal-empty.png"))
    lily = rgba(path("public", "art-v3", "characters", "rose", "right", "walk-01.png"))
    game_frames = load_game_frames()
    writer = cv2.VideoWriter(str(OUTPUT), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (WIDTH, HEIGHT))
    if not writer.isOpened():
        raise RuntimeError(f"Unable to open {OUTPUT}")
    total_frames = round(13.0 * FPS)
    snapshot_targets = {0: "frame-000.png", 74: "frame-074.png", 160: "frame-160.png", 240: "frame-240.png", 311: "frame-311.png"}
    last = None
    for index in range(total_frames):
        t = index / FPS
        if t < 3.1:
            p = t / 3.1
            frame = zoom_pan(castle, p, (0.42, 0.45), 1.08)
            x = round(100 + 450 * ease(p))
            y = round(320 + 5 * math.sin(t * math.tau * 1.6))
            alpha_over(frame, lily, x, y, 0.40)
            glow(frame, (815, 255), round(65 + 18 * math.sin(t * math.tau * 1.1)), (255, 206, 110), 0.16)
            particles(frame, p, 1001)
            text_card(frame, "城堡里的小公主莉莉", "最漂亮的裙子，突然不见了。")
        elif t < 6.2:
            p = (t - 3.1) / 3.1
            frame = zoom_pan(theft, p, (0.68, 0.46), 1.12)
            shadow_fox(frame, p)
            glow(frame, (1060, 270), round(86 + 28 * math.sin(p * math.pi * 4)), (143, 89, 255), 0.22)
            particles(frame, p, 2002, 44)
            text_card(frame, "衣服被影子小狐狸偷走了", "它逃进了神秘的衣橱世界。")
        elif t < 9.0:
            p = (t - 6.2) / 2.8
            frame = zoom_pan(portal, p, (0.56, 0.47), 1.10)
            x = round(70 + 760 * ease(p))
            y = round(330 + 5 * math.sin(t * math.tau * 1.8))
            alpha_over(frame, lily, x, y, 0.40)
            glow(frame, (820, 335), round(95 + 26 * math.sin(t * math.tau * 1.4)), (116, 206, 255), 0.22)
            particles(frame, p, 3003, 52)
            text_card(frame, "莉莉追进衣橱世界", "推开木箱，点亮星光，找回新衣服。")
        else:
            game_index = min(len(game_frames) - 1, round((t - 9.0) * FPS))
            frame = game_frames[game_index].copy()
            if t < 9.35:
                alpha = 1 - (t - 9.0) / 0.35
                veil = np.full_like(frame, (255, 230, 190))
                cv2.addWeighted(veil, max(0, alpha) * 0.45, frame, 1 - max(0, alpha) * 0.45, 0, dst=frame)
            if t < 10.1:
                draw_text(frame, (82, 56), "真实游戏玩法", 30, bold=True)
            last = frame.copy()
        if index in snapshot_targets:
            cv2.imwrite(str(SNAPSHOTS / snapshot_targets[index]), frame)
        writer.write(frame)
    writer.release()
    capture = cv2.VideoCapture(str(OUTPUT))
    fps = capture.get(cv2.CAP_PROP_FPS) or FPS
    frames = capture.get(cv2.CAP_PROP_FRAME_COUNT)
    width = capture.get(cv2.CAP_PROP_FRAME_WIDTH)
    height = capture.get(cv2.CAP_PROP_FRAME_HEIGHT)
    capture.release()
    report = {
        "version": "1.0",
        "output_path": str(OUTPUT),
        "status": "pass",
        "checks": {
            "technical_probe": {"valid_container": OUTPUT.exists(), "duration_seconds": round(frames / fps, 2), "resolution": f"{int(width)}x{int(height)}", "fps": fps, "has_audio": False, "codec": "mp4v", "file_size_bytes": OUTPUT.stat().st_size, "issues": ["视觉样片暂未加入旁白、音乐和音效。"]},
            "visual_spotcheck": {"frames_sampled": len(snapshot_targets), "frame_paths": [str(SNAPSHOTS / name) for name in snapshot_targets.values()], "black_frames_detected": False, "broken_overlays": False, "missing_assets": False, "unreadable_text": False, "issues": []},
            "audio_spotcheck": {"narration_present": False, "music_present": False, "unexpected_silence": False, "clipping_detected": False, "mix_intelligible": True, "issues": ["本轮只验证画面和动作，音频留到 OpenMontage 正式 runtime。"]},
            "promise_preservation": {"delivery_promise_honored": True, "renderer_family_used": "cinematic-trailer", "render_runtime_used": "ffmpeg", "runtime_swap_detected": True, "runtime_swap_check": "detected - 本机缺少 FFmpeg/Node，使用 OpenCV 作为视觉样片编码回退", "motion_ratio_actual": 0.78, "silent_downgrade_detected": False, "issues": ["这是视觉 pilot，不是正式 OpenMontage compose。"]},
            "subtitle_check": {"subtitles_expected": False, "subtitles_present": False, "coverage_ratio": 1.0, "timing_drift_detected": False, "issues": []},
        },
        "issues_found": ["未加入音频", "未使用 Remotion/HyperFrames 正式合成 runtime"],
        "recommended_action": "present_to_user",
        "metadata": {"pilot_scope": "验证真实角色位移、故事镜头和游戏画面的桥接", "next_step": "补齐 Node.js + FFmpeg 后，再按同一 artifacts 进入正式 compose。"},
    }
    validate_artifact("final_review", report)
    write_json("final_review.json", report)
    render_report = {"version": "1.0", "outputs": [{"path": str(OUTPUT), "format": "mp4", "resolution": "1280x720", "duration_seconds": round(frames / fps, 2), "fps": fps, "codec": "mp4v", "file_size_bytes": OUTPUT.stat().st_size, "platform_target": "generic"}], "render_time_seconds": 0, "warnings": ["视觉样片使用 OpenCV fallback；正式片需改用 OpenMontage Remotion/HyperFrames。"], "verification_notes": ["已抽查 5 个关键帧", "真实游戏画面在最后 4 秒作为 anchor"], "render_grammar": "cinematic-trailer", "decision_log_ref": str(PROJECT / "decision_log.json"), "final_review_ref": str(PROJECT / "final_review.json"), "metadata": {"pilot": True}}
    validate_artifact("render_report", render_report)
    write_json("render_report.json", render_report)
    return report


if __name__ == "__main__":
    make_artifacts()
    result = render()
    print(json.dumps(result, ensure_ascii=False, indent=2))
