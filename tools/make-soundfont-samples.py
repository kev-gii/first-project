#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 AURORA 演示站的 SoundFont 采样（纯标准库，无依赖）。

输出到 assets/soundfont/：
  - 4 个声部示范（strings / woodwinds / brass / percussion）
  - 6 个常演曲目主题动机（与 script.js 里的 P 音序一致，取前 8 拍）
  - manifest.json（键 → 文件 + 时长，供前端 SoundSamples 模块加载）

前端通过 fetch + decodeAudioData 把 WAV 解码为 AudioBuffer，
用 BufferSource 循环播放（SoundFont 式"采样发声"）；
采样缺失（如以 file:// 直接打开）时自动回退为振荡器现场合成。

重新生成：python3 tools/make-soundfont-samples.py
"""
import array
import json
import math
import os
import random
import wave

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(os.path.dirname(HERE), "assets", "soundfont")
os.makedirs(BASE, exist_ok=True)

# 音高表（与 script.js 的 N 表一致）
F = {
    "Gb2": 83.31, "A2": 110.0, "Bb2": 116.54, "C3": 130.81,
    "D4": 293.66, "Eb4": 311.13, "E4": 329.63, "F4": 349.23,
    "G4": 392.0, "A4": 440.0, "B4": 493.88, "C5": 523.25,
    "D5": 587.33, "B3": 246.94, "A3": 220.0, "Bb3": 233.08,
}

TEMPO = 0.42  # 每拍秒数（与 script.js 一致）

# 各曲目前 8 拍（对应 script.js P 表的前 8 拍，保证音序相同）
TRACKS = {
    "bach": [(F["C4"], 1) if "C4" in F else (261.63, 1),
             (F["E4"], 1), (F["G4"], 1), (523.25, 2),
             (F["B4"], 1), (F["A4"], 1), (F["G4"], 1)],
    "mozart": [(261.63, 1), (F["E4"], 1), (F["G4"], 1), (523.25, 1),
               (F["B4"], 1), (F["G4"], 1), (F["A4"], 1), (F["G4"], 1)],
    "beethoven": [(F["G4"], 1), (F["G4"], 1), (F["G4"], 1), (F["Eb4"], 3),
                  (F["G4"], 1), (F["G4"], 1)],
    "tchaikovsky": [(F["B4"], 2), (F["G4"], 1), (F["D5"], 3), (F["B4"], 2)],
    "dvorak": [(F["B3"], 3), (F["A3"], 3), (F["D4"], 1), (F["F4"], 1)],
    "mahler": [(F["Gb2"], 2), (F["A2"], 2), (261.63, 2), (F["D4"], 2)],
}
TRACKS["bach"][0] = (261.63, 1)  # C4 不在表里，直接写数值

# 音色参数：partials=(谐波, 幅值) / rolloff 谐波衰减指数 / attack / release /
#            vibrato=(频率 Hz, 延迟 s, 深度(频率的比例))
KINDS = {
    "strings": dict(partials=[(1, 1.0), (2, .48), (3, .26), (4, .15), (5, .08), (6, .05)],
                    rolloff=.35, attack=.35, release=.45, vib=(4.6, .55, .0045)),
    "reed": dict(partials=[(1, 1.0), (2, .30), (3, .18), (4, .08), (5, .05)],
                 rolloff=.30, attack=.07, release=.30, vib=(5.4, .45, .0035)),
    "brass": dict(partials=[(1, 1.0), (2, .55), (3, .34), (4, .22), (5, .13), (6, .08), (7, .05)],
                  rolloff=.25, attack=.14, release=.50, vib=(5.0, .50, .0040)),
    "piano": dict(partials=[(1, 1.0), (2, .52), (3, .30), (4, .16), (5, .09), (6, .05)],
                  rolloff=.28, attack=.012, release=.60, vib=(0, 0, 0)),
}


def add_note(s, t0, f0, dur, kind, amp=1.0):
    """在 s 上叠加一个音：多层谐波 + 谐波衰减 + ADSR + 颤音（采样级"真实感"）。"""
    kc = KINDS[kind]
    i0 = int(t0 * SR)
    nd = int(dur * SR)
    n_total = len(s)
    vr, vd, depth = kc["vib"]
    for k, a in kc["partials"]:
        f = f0 * k
        aa = a * (k ** -kc["rolloff"]) * amp
        ph = 0.0
        for i in range(nd):
            t = i / SR
            e = 1.0
            if t < kc["attack"]:
                e = t / kc["attack"]
            rem = dur - t
            if rem < kc["release"]:
                e *= max(0.0, rem / kc["release"])
            if depth and t > vd:
                vt = min(1.0, (t - vd) / 0.8)
                f_eff = f * (1.0 + depth * vt * math.sin(2 * math.pi * vr * t))
            else:
                f_eff = f
            ph += f_eff / SR
            j = i0 + i
            if j < n_total:
                s[j] += aa * e * math.sin(2 * math.pi * ph)


def add_noise(s, t0, dur, level, lp=0.1, decay=4.0):
    """一阶低通白噪声 × 指数衰减（弓弦摩擦 / 簧片呼吸声）。"""
    i0 = int(t0 * SR)
    nd = int(dur * SR)
    x = 0.0
    for i in range(nd):
        t = i / SR
        w = random.random() * 2 - 1
        x += lp * (w - x)
        a = 1.0
        if t < 0.02:
            a = t / 0.02
        j = i0 + i
        if j < len(s):
            s[j] += level * math.exp(-decay * t) * a * x


# ---------- 打击乐组件 ----------

def stick(s, t0, level=0.7):
    """鼓槌敲击：双极带通噪声爆点。"""
    i0 = int(t0 * SR)
    nd = int(0.35 * SR)
    x1 = x2 = 0.0
    for i in range(nd):
        t = i / SR
        w = random.random() * 2 - 1
        x1 += 0.19 * (w - x1)
        x2 += 0.19 * (x1 - x2)
        a = 1.0 if t >= 0.004 else t / 0.004
        j = i0 + i
        if j < len(s):
            s[j] += level * math.exp(-16 * t) * a * x2


def tom(s, t0, f=130.81, level=0.9, dur=0.6):
    """定音鼓：正弦胸鼓 + 滑音（音高下滑）。"""
    i0 = int(t0 * SR)
    nd = int(dur * SR)
    ph = 0.0
    for i in range(nd):
        t = i / SR
        fr = f * (1 + (0.5 - 1) * min(1.0, t / 0.35))
        ph += 2 * math.pi * fr / SR
        j = i0 + i
        if j < len(s):
            s[j] += level * math.exp(-4.2 * t) * math.sin(ph)


def cymbal(s, t0, level=0.4, decay=1.9, dur=2.2):
    """镲：高通化噪声 × 长衰减（金属闪响）。"""
    i0 = int(t0 * SR)
    nd = int(dur * SR)
    x = 0.0
    for i in range(nd):
        t = i / SR
        w = random.random() * 2 - 1
        hp = w - x
        x += 0.35 * (hp - x)
        j = i0 + i
        if j < len(s):
            s[j] += level * math.exp(-decay * t) * x * 0.7


# ---------- 各文件的填充逻辑 ----------

def fill_strings(s):
    for f0 in (261.63, 329.63, 392.0, 523.25):  # C 大调四和弦
        add_note(s, 0.15, f0, 3.3, "strings", 0.30)
    add_noise(s, 0.6, 2.6, 0.05, lp=0.08, decay=1.4)  # 持续的弓弦摩擦声


def fill_woodwinds(s):
    for f0, off in ((392.0, 0.1), (440.0, 0.95), (493.88, 1.8), (587.33, 2.65)):
        add_note(s, off, f0, 0.85, "reed", 0.8)
        add_noise(s, off + 0.04, 0.5, 0.10, lp=0.2, decay=9.0)  # 起音呼吸


def fill_brass(s):
    for f0 in (130.81, 261.63, 329.63, 392.0):  # C3 起的宽和弦
        add_note(s, 0.2, f0, 3.2, "brass", 0.30)
    add_noise(s, 0.25, 1.2, 0.03, lp=0.1, decay=3.0)


def fill_percussion(s):
    for t in (0.0, 0.5, 1.0, 1.5, 1.7, 1.9, 2.1):
        stick(s, t, 0.7 if t < 1.4 else 0.5)
    for t in (0.0, 1.5, 3.0):
        tom(s, t, 130.81, 0.9)
    cymbal(s, 2.1, 0.45, decay=1.8, dur=1.8)
    stick(s, 3.4, 0.9)
    tom(s, 3.4, 130.81, 1.0, dur=0.8)
    cymbal(s, 3.4, 0.35, decay=6.0, dur=0.7)


def fill_track(name, s):
    t = 0.12
    for f0, beats in TRACKS[name]:
        dur = beats * TEMPO * 0.92
        add_note(s, t, f0, dur, "piano", 0.85)
        add_note(s, t, f0 * 0.5, dur * 0.9, "piano", 0.30)  # 低八度加厚
        t += beats * TEMPO


# ---------- 输出 ----------

FILES = [
    ("strings.wav", 4.0, fill_strings, 11),
    ("woodwinds.wav", 4.0, fill_woodwinds, 22),
    ("brass.wav", 4.0, fill_brass, 33),
    ("percussion.wav", 4.0, fill_percussion, 44),
]
for i, name in enumerate(TRACKS):
    FILES.append((name + ".wav", 4.0, (lambda n: lambda s: fill_track(n, s))(name), 55 + i))


manifest = {
    "meta": {"format": "44.1kHz mono 16-bit WAV", "note": "由 tools/make-soundfont-samples.py 生成"},
    "voice": {},
    "track": {},
}
total = 0
for fname, dur, fill, seed in FILES:
    random.seed(seed)
    s = [0.0] * int(dur * SR)
    fill(s)
    m = max(abs(v) for v in s) or 1.0
    g = 0.86 / m  # 削峰归一
    s = [v * g for v in s]
    fade = int(0.025 * SR)
    for i in range(fade):
        s[i] *= i / fade
        s[-1 - i] *= i / fade
    data = array.array("h", (max(-32767, min(32767, int(v * 32767))) for v in s))
    path = os.path.join(BASE, fname)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    size = os.path.getsize(path)
    total += size
    key = fname[:-4]
    if key in TRACKS:
        manifest["track"][key] = {"file": fname, "duration": dur}
    else:
        manifest["voice"][key] = {"file": fname, "duration": dur}
    print(f"  {fname:<16} {dur:.1f}s  {size // 1024} KB")

with open(os.path.join(BASE, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
    f.write("\n")

print(f"done: {len(FILES)} files, {total // 1024} KB total -> {BASE}")
