# XQL MUSIC

多源聚合在线音乐播放器，支持网易云音乐、JOOX、Audius 的歌曲搜索与播放。

## 📢 最新更新 (2026-08-30)

### 🎵 音源更新迭代
- **新增 JOOX 音源**：搜索 / 播放 / 歌词 / 封面全链路可用，作为酷我失效后的主力替代源。
- **新增 Audius 音源**：接入去中心化音乐平台 Audius 公开 API（无需 key、全球可访问），以欧美 lofi / 电子 / 嘻哈 / 独立音乐为主，与华语源互补。已过滤 `is_streamable: false` 与门控曲目，避免点播 404。
- **修复酷我播放失效**：上游 `types=url&source=kuwo` 已废，改为服务端跨源兜底——按歌名 + 歌手重新到 netease / joox 匹配取真实播放地址。
- **修复 QQ 播放错配**：原先把 QQ 的 songmid 拿去请求网易云必然失败，跨源兜底链改为 `wy → jx`。
- **移除 pjmp3 音源**：源站 HTTPS 已不可用，相关代理与前端引用一并下架。
- **上游双通道容错**：三个代理均改为 `music-api.gdstudio.xyz` 直连优先、`smusic0.pages.dev` 兜底；网易云再加 Meting 镜像作末级兜底。
- **剔除无法播放的音源**：实测酷我 8/8 首曲目的播放地址全部来自网易云 CDN——它自身零播放能力，只是个搜索入口；QQ 同样无法拿到自己的 vkey。两者连同已失效的 YouTube(Invidious) 端点一并下架，只保留能提供自有音频的源。
- **未知音源不再静默回退**：`SOURCE_MAP` 查不到的 type 直接返回空结果，避免已下架的源退回别家曲库冒名顶替。

---

## 在线体验

- [https://lesou-music.pages.dev](https://lesou-music.pages.dev)
- [https://mp3.freedom8964.com](https://mp3.freedom8964.com)

## 功能特性

### 音乐播放
- 多平台聚合搜索（网易云 / JOOX / Audius / 全网聚合）
- 歌词同步显示（支持 LRC 逐行高亮）
- 播放模式切换（顺序播放 / 随机播放 / 单曲循环）
- 播放队列管理（添加、移除、清空）
- 上一首 / 下一首、进度拖拽
- 锁屏控制（Media Session API）

### 音频处理
- 31 段均衡器（20Hz – 20kHz），支持 SVG 曲线可视化
- 9 种 EQ 预设（摇滚、流行、爵士、古典、低音增强、高音增强、人声、电子、平坦）
- 杜比全景声模拟（双声道延迟 + 交叉馈送 + 卷积混响 + 低频增强）
- 3 倍增益调节

### 用户系统
- 注册 / 登录（仅限英文字母和数字）
- 收藏歌曲（全部播放 / 随机播放）
- 数据本地存储（localStorage）

### 界面
- 响应式布局，支持移动端
- 侧边栏导航
- 热门歌手快捷入口
- 搜索历史记录
- 键盘快捷键（空格暂停、方向键调节进度和音量）

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite 6 |
| 样式 | Tailwind CSS + 自定义 CSS |
| 音频处理 | Web Audio API（BiquadFilterNode / GainNode / ConvolverNode） |
| 部署 | Cloudflare Pages |
| API 代理 | Cloudflare Pages Functions |

## 项目结构

```
src/
├── components/       # React 组件
│   ├── Player.tsx        # 底部播放器
│   ├── Equalizer.tsx     # 31 段均衡器面板
│   ├── LyricsOverlay.tsx # 歌词浮层
│   ├── SearchPage.tsx    # 搜索页
│   ├── StarredPage.tsx   # 收藏页
│   ├── HomePage.tsx      # 发现音乐页
│   ├── QueuePanel.tsx    # 播放队列
│   ├── Sidebar.tsx       # 侧边栏（含登录/注册）
│   └── ...
├── hooks/            # 自定义 Hooks
│   ├── usePlayer.ts      # 播放控制核心逻辑
│   ├── useEqualizer.ts   # 均衡器状态与滤波器
│   ├── useSearch.ts      # 搜索与分页
│   ├── useLyrics.ts      # 歌词解析与同步
│   ├── useUser.ts        # 用户注册/登录/收藏
│   └── useKeyboard.ts    # 键盘快捷键
├── utils/            # 工具函数
│   ├── storage.ts        # localStorage 读写
│   ├── cache.ts          # 请求缓存
│   └── format.ts         # 时间格式化等
├── config.ts         # API 端点与平台配置
├── types.ts          # TypeScript 类型定义
└── App.tsx           # 应用入口

functions/api/        # Cloudflare Pages Functions（服务端代理）
├── search.ts             # 搜索代理
├── song.ts               # 歌曲详情/URL/歌词代理
├── gd.ts                 # 聚合源代理
├── audius.ts             # Audius 源代理（搜索 / 详情）
├── youtube-search.ts     # YouTube (Invidious) 搜索代理
└── audio-proxy.ts        # 音频流 CORS 代理
```

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 部署

项目使用 Cloudflare Pages 部署，`functions/` 目录下的 API 代理会自动部署为 Pages Functions。

```bash
# 手动部署
npx wrangler pages deploy dist --project-name=lesou-music
```

## License

MIT
