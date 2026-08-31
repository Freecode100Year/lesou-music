# XQL MUSIC

多源聚合在线音乐播放器，支持网易云音乐、JOOX、Audius 的歌曲搜索与播放。

## 📢 最新更新 (2026-08-30)

### 🎧 有线入耳式听感优化 + 音箱外放模式
- **修掉播放中每秒 4 次的重连**：音频图的重建 effect 依赖了每次 render 都新建的 equalizer 对象，`timeupdate` 一触发就整条链路 disconnect/reconnect，表现为持续的细碎断音。改为稳定引用 + 拓扑指纹比对，只有链路形状真的变了才重连。
- **均衡器预设改为各品牌耳机默认调音曲线**：索尼 / Bose / AirPods / 森海塞尔 / Beats / 三星 AKG / JBL / 小米 / 华为 / 舒尔 / 铁三角 / 拜亚动力 / B&O，外加哈曼 IE 目标与平坦作为基准。按各家出厂调音相对哈曼入耳目标的偏差拟合。
- **EQ 自动预衰减**：31 段 1/3 倍频程滤波器互相叠加，一排 +4 dB 实际给到约 +6 dB。现在按估算峰值自动扣回增益，不再一开预设就整首歌顶着限制器泵。
- **齿音抑制（入耳专属）**：LR4 分频在 5.5 kHz 切开，只对高频段做压缩——入耳封闭耳道把共振推到 6–8 kHz，正好压在 320 kbps 有损编码最毛糙的地方。默认开启。
- **等响度补偿**：入耳隔音好、听感音量低，低音随音量下降掉得最快（ISO 226）。低频/高频搁架随音量自动补偿，音量拉满时归零。默认开启。
- **交叉馈送分四档**：关 / 轻 / 中 / 强，播放器按钮循环切换，默认「中」。
- **音量改为感知曲线并移入音频图**：滑杆中点对应 −12 dB；同时音量不再位于响度均衡的测量点之前，避免自动音量和用户调音量互相打架。
- **响度均衡改用 K 计权**：按 BS.1770 加计权后测量，3 秒窗口 + 门限，低频多的曲子不再被误判为"响"。
- **切歌 / 暂停 / 播放全程淡入淡出**：换 src 是波形上的阶跃，在封闭入耳里就是一声"啪"。
- **超低频高通**：耳机模式 20 Hz、音箱模式 55 Hz，把只吃余量不出声的次声砍掉。
- **限制器重新整定**：移到音量之后，阈值 −1.5 dB、释放 200 ms，只当削顶保护用。
- **修正交叉馈送的中置像染色**：原先把补偿搁架放在直达路径上、且频点取交叉馈送转折频率——但低通在转折点带约 90° 相移，直达与交叉信号在那里并非算术相加，中置像（人声与低频所在）实测有 1.5–4.0 dB 起伏。改为在合并后的输出上做补偿，频点与深度按档位数值求解，起伏压到 0.50 / 0.79 / 1.08 dB。
- **新增 `npm run verify:audio`**：按 Audio EQ Cookbook 复现 Web Audio 的双二阶系数，直接算整条链路的真实传递函数，校验预衰减是否够、交叉馈送中置像是否平坦、LR4 求和是否透明、Marshall 曲线净增益是否过零、各音量点是否越过满刻度。上面那条中置像染色就是它查出来的。
- **新增音箱外放模式**：播放器独立开关，套用 Marshall 有源音箱默认音色（90 Hz 低频搁架 + 3.2 kHz 存在感抬升 + 11 kHz 以上收敛），并自动旁路交叉馈送与齿音抑制这两项耳机专属处理。

---

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
- 31 段均衡器（20Hz – 20kHz），支持 SVG 曲线可视化，带自动预衰减
- 15 种 EQ 预设：平坦、哈曼 IE 目标，以及索尼 / Bose / AirPods / 森海塞尔 / Beats / 三星 AKG / JBL / 小米 / 华为 / 舒尔 / 铁三角 / 拜亚动力 / B&O 的默认调音曲线
- 耳机交叉馈送（Bauer/Meier 式，关 / 轻 / 中 / 强四档）
- 齿音抑制（LR4 分频 + 高频段压缩）与等响度补偿（ISO 226）
- 音箱外放模式：Marshall 有源音箱默认音色，自动旁路耳机专属处理
- K 计权响度均衡、感知音量曲线、切歌淡入淡出、超低频高通、削顶限制器
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

# 校验音频链路的频域特性（改动任何滤波器常数后都应跑一次）
npm run verify:audio
```

## 部署

项目使用 Cloudflare Pages 部署，`functions/` 目录下的 API 代理会自动部署为 Pages Functions。

```bash
# 手动部署（必须带 --branch=main）
npx wrangler pages deploy dist --project-name=lesou-music --branch=main
```

> Cloudflare Pages 侧的生产分支名是 `main`，而本仓库的 git 分支是 `master`。
> 不带 `--branch=main` 时 wrangler 会按当前 git 分支上传，部署落到 `master`
> 预览环境（`master.lesou-music.pages.dev`），`mp3.freedom8964.com` 不会更新。

## License

MIT
