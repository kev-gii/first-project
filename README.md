# AURORA 交响乐团 · 演示站点

一个以交响乐为主题的纯前端演示网站，**运行时零依赖**（原生 HTML + CSS + ES6+ JavaScript，无任何框架），并用 **Vite** 做本地开发（HMR）与模块化打包。

## 功能特性

- **背景画布** — 漂浮上升的金色音符粒子（Canvas 实现）
- **数字滚动动画** — 乐团统计数字在进入视口时递增
- **声部试听** — 四大声部卡片可点击试听，音色按声部定制合成（弦乐颤音 + 失谐和弦叠层、木管簧片起音 + 呼吸声、铜管加宽和弦、打击乐噪声包络鼓槌 + 低频鼓胸），无需任何音频文件
- **迷你播放器** — 常演曲目下方六首主题动机试听列表（命运、自新大陆、天鹅湖等全部现场合成），点选循环播放，当前曲目高亮 + 进度条推进
- **全局音频控制台** — 右下角悬浮控制台：音量滑块 + AnalyserNode 金色频谱，背景音符粒子随音频电平律动（声音越响粒子越亮、飘得越快）
- **演出日程** — 演出数据外置 `data/concerts.json`（fetch 加载，内容更新无需改 JS，失败时回退内嵌数据），动态渲染并支持"已售罄"状态；每场可下载 `.ics` 加日历
- **购票表单** — 姓名 / 邮箱 / 会员等级校验，含成功与错误提示
- **选座购票** — 演出卡片可直接跳转入半圆看台 SVG 座位图（12 排 × 21 座 = 252 座），三档票价（VIP 前区 ¥880 / 金卡区 ¥560 / 普通区 ¥380），点选最多 8 座并生成可复制的订单摘要；同一场次的已售座位分布稳定
- **声部/曲目试听** — 优先使用 `assets/soundfont` 真实采样层（44.1kHz WAV，`fetch + decodeAudioData`），资产缺失时自动回退现有振荡器合成，音色与主题动机完全一致
- **响应式布局** — 移动端汉堡菜单，深色 + 金铜色调设计
- **主题切换** — 深色「舞台」↔ 浅色「排练厅」一键切换（localStorage 记忆）；夜间 19:00–7:00 自动叠加冷蓝「音乐厅灯光」色调
- **设计令牌** — 全部色值抽成 CSS 变量集中管理，换肤只改 `:root`
- **Hero 视觉** — 虚化音乐厅照片 + 暗色蒙层 + 模糊渐显（blur-up）动效
- **视觉素材** — 指挥家聚光剪影 SVG、作曲家手稿纹章（乐谱线 + 生卒年徽标）
- **细节动效** — 小节线 + 谱号分隔符、按钮金属高光扫过、卡片共振脉冲

## 页面结构

| 区块 | 锚点 | 说明 |
| --- | --- | --- |
| 导航 | `#nav` | 固定顶栏，滚动后出现阴影 |
| 首页 | `#home` | Hero 区 + 统计数字 |
| 声部 | `#sections` | 弦乐 / 木管 / 铜管 / 打击乐试听卡片 |
| 指挥家 | `#conductors` | 四位指挥介绍 |
| 常演曲目 | `#repertoire` | 六首经典曲目 + 迷你播放器（主题动机试听） |
| 演出日程 | `#concerts` | 数据外置 `data/concerts.json` 动态渲染的演出列表，支持"已售罄"状态与 `.ics` 加日历 |
| 选座购票 | `#seatmap` | 半圆看台 SVG 座位图（12 排 × 21 座），三档票价 + 点选 8 座 + 订单摘要 |
| 购票 | `#ticket` | 乐友申请表单 |

## 文件说明

```
index.html                 页面结构（导航、各区块、座位图、表单）
src/
  main.js                  入口：按序初始化各模块
  style.css                样式（配色、布局、响应式、动画，全部色值为 CSS 变量）
  core/                    功能模块（画布、导航/主题、数字滚动、声部、演出、
                           迷你播放器、音频控制台、表单、座位图、共享工具）
  audio/
    audio-bus.js           共享音频总线（Web Audio 上下文 + 主增益 + 分析节点）
    sound-samples.js       采样层（fetch + decodeAudioData 预拉 WAV，缺失回退合成）
public/
  assets/                  静态素材（Hero 图、指挥家/作曲家 SVG、soundfont 采样层）
  data/concerts.json       演出日程（fetch 外置数据）
tools/make-soundfont-samples.py  采样生成脚本（Python 标准库，生成 WAV 与 manifest）
vite.config.js             Vite 构建配置（base:"./" 子路径安全、产物入 dist/vendor/）
package.json               Vite 开发依赖 + 脚本（dev / build / preview）
```

## 本地开发与构建

```bash
npm install       # 安装 Vite（仅开发工具，运行时零依赖）
npm run dev       # 本地开发（HMR，热更新）
npm run build     # 生产构建，产物输出到 dist/
npm run preview   # 在本地预览 dist/ 构建产物
```

> 直接双击 `index.html` 也能跑（模块经 Vite 解析），但**采样试听与演出数据需经 HTTP 服务**（`file://` 下 `fetch` 受限），故推荐 `npm run dev` / `npm run preview`。

## 部署（GitHub Pages）

推送到 `main` 后，`.github/workflows/github-pages.yml` 自动用 Vite 构建并把 `dist/` 发布到 GitHub Pages：

1. 仓库 **Settings → Pages → Source** 选择 **GitHub Actions**
2. 之后每次 `push` 到 `main` 自动构建 + 发布
3. 产物用 `base: "./"`，在 `/first-project/` 子路径可直接打开（无需为部署环境改代码）

> 也可改用 Cloudflare Pages / Vercel，配自定义域名与 CNAME（HTTPS 由 Pages 默认提供）。

## 使用方法

推荐用 Vite 本地开发服务（HMR + 可正常 `fetch` 采样与演出数据）：

```bash
npm install
npm run dev        # 打开终端提示的本地地址即可
```

> 声部试听与曲目试听需用户点击触发（浏览器自动播放策略限制）；首次点击后全局音频总线激活，频谱与粒子随之律动。

## 技术栈

- HTML5 / CSS3 / 原生 ES6+ JavaScript
- Canvas API（粒子背景、金色频谱）
- Web Audio API（声部音色合成、AnalyserNode 频谱、共享音频总线；优先播放 `assets/soundfont` 采样，缺失自动回退振荡器）

## 许可

演示项目，自由使用。
