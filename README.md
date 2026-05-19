# XQL MUSIC

多源聚合在线音乐播放器，支持网易云音乐、酷我音乐、QQ音乐等平台的歌曲搜索与播放。

## 在线体验

- [https://lesou-music.pages.dev](https://lesou-music.pages.dev)
- [https://mp3.freedom8964.com](https://mp3.freedom8964.com)

## 功能特性

### 音乐播放
- 多平台聚合搜索（网易云 / 酷我 / QQ音乐 / 全网聚合）
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
├── pjmp3.ts              # pjmp3 源代理
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
