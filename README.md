# 挪对对 · 地狱模式

移动端优先的高密度麻将滑动配对解谜游戏。前端使用原生 HTML、CSS、JavaScript；后端使用 Cloudflare Worker；云端存档和排行榜使用 Cloudflare D1。

本文档面向后续开发者和 AI Agent，记录当前基线的产品规则、数据模型、UI 约束、算法和部署方式。修改代码前应先阅读“不可破坏的产品约束”。

## 在线入口

- 正式入口：https://move-mahjong-hell.game.foxtang.com
- 参考牌面入口：https://mahjong.game.foxtang.com
- 参考牌面备用路径：https://move-mahjong-hell.game.foxtang.com/reference-game
- GitHub：https://github.com/th2006464/move-mahjong-hell

两个入口共用同一个 Worker、同一个 public/index.html、同一套游戏逻辑和同一个 D1；只有牌面主题不同。

## 不可破坏的产品约束

- 棋盘固定为 20 列 × 24 行，共 480 格。
- 新局必须满屏铺牌，不能在开局主动预留空位。
- 牌只能横向或纵向移动，不能斜向移动，也不能穿过其他牌。
- 当前牌型是 1–9 万、1–9 条、1–9 饼，以及红中、发财、白板，共 30 种；当前版本没有东南西北。
- 同牌只要同行或同列且中间没有障碍，点击任意一张即可直接消除，不要求紧挨。
- 移动只有在移动后立即形成有效配对时才提交；否则必须回到原位。
- 推动连续牌组时，选中的牌与移动方向上连续相邻的牌整体移动，内部顺序不变。
- 每成功消除一对得 1 分。
- 清空棋盘自动结束并打开本局排行榜。
- 没有可行操作时暂停计时并弹出“洗牌继续 / 结束游戏”。
- 自由模式记录实际用时；倒计时模式可在开局前设置 1–99 分钟，到 0 自动结束。
- 选择牌时不显示黄色框；空位保留细参考线，帮助行列对齐。
- 牌必须保持当前的窄高矩形样式、细灰色分割线和细棕色外框。

## 文件结构

~~~text
move-mahjong-hell/
├── public/index.html                       # 页面、CSS、牌面和全部前端逻辑
├── public/service-worker.js                # PWA 离线缓存
├── public/manifest.webmanifest             # 添加到主屏幕配置
├── public/assets/reference-tile-atlas.webp # 参考牌面图集
├── public/audio/background.mp3             # 循环背景音乐
├── public/audio/match.mp3                  # 消除音效
├── public/icons/                           # PWA 图标
├── public/svg-game-preview.html            # SVG 牌面实验页，不是正式入口
├── public/tiles-preview.html              # 图集预览页，不是正式入口
├── src/index.js                            # Worker API 和静态资源入口
├── migrations/0001_mahjong_progress_and_scores.sql
├── migrations/0002_mahjong_save_history.sql
├── wrangler.jsonc                          # Worker、D1、Assets、域名配置
└── package.json
~~~

当前前端是原生单文件应用，没有 React/Vue 和构建打包流程。index.html 中脚本和样式压缩在少数长行中，修改时应使用 rg -n 定位并用补丁精确修改，不要整页格式化。

## 两套 UI 入口

主题由域名、路径和查询参数决定：

~~~js
const REFERENCE_ART =
  location.hostname === 'mahjong.game.foxtang.com' ||
  location.pathname.startsWith('/reference-game') ||
  new URLSearchParams(location.search).has('referenceArt');

document.documentElement.classList.toggle('reference-art', REFERENCE_ART);
~~~

普通入口使用 Unicode 麻将字符。参考入口使用 public/assets/reference-tile-atlas.webp：

~~~css
.reference-art .glyph.reference-face {
  background-image: url('/assets/reference-tile-atlas.webp');
  background-size: 1000% 300%;
}
~~~

Worker 对 /reference-game 返回同一个首页资源。不要复制第二份 index.html，也不要复制第二套棋盘逻辑。新增主题应继续使用根元素 class，仅切换视觉资源和 CSS。

## 牌型和图集

GLYPHS 是正式牌型来源，顺序固定：

| ID 索引 | 牌类 | 数量 |
|---|---|---:|
| 0–8 | 1–9 万 | 9 |
| 9–17 | 1–9 条 | 9 |
| 18–26 | 1–9 饼 | 9 |
| 27 | 红中 | 1 |
| 28 | 发财 | 1 |
| 29 | 白板 | 1 |

TYPES 生成 id、glyph、kind。id 会写入存档，不能随意重新编号；旧版本 ID 兼容关系在 LEGACY_ID_MAP 中，不能删除。

普通牌面直接渲染 glyph Unicode 字符，并用 man、bam、dot、dragon-red、dragon-green、dragon-white 控制颜色。

参考图集是 10 列 × 3 行。索引 i 通过 col = i % 10、row = Math.floor(i / 10) 定位，CSS 使用 background-size: 1000% 300%。替换图集时必须保持格子顺序，否则显示牌面会和逻辑 ID 错位。

## 棋盘数据模型

~~~js
const ROWS = 24;
const COLS = 20;
~~~

grid[r][c] 是二维数组：

- null 表示空位。
- 非空值是包含 id、glyph、kind 的牌对象。
- 坐标统一使用 { r, c }，不要混用 { row, col }。

fresh() 创建 240 对牌、随机打乱，再切成 24×20。新局初始不能有空位；空位只能由消除和合法移动产生。

## 消除和移动

### 直接消除

alignedOn(board, p) 扫描同行/同列的同牌；clearOn(board, a, b) 检查两点之间是否全为空。必须同时满足：牌 ID 相同、同行或同列、中间无障碍。

remove(a, b, message) 将两格设为 null，分数加 1，播放消除音效，重新渲染并重新检查局面。

### 单张移动

拖动或“先点牌、再点同线空位”都进入同一移动逻辑。目标必须在同一行或列，路径只能穿过连续空位。移动先临时写入目标，再检查是否形成配对：成功则提交，失败则恢复起点和目标格。

动画期间由 animating 锁定输入，避免快速连续操作造成数据竞争。不要只删除视觉 DOM 元素；所有状态变化必须先正确更新 grid。

### 连续牌组推动

moveGroup(fromPos, toPos)：

1. 按方向收集起点前方的连续牌。
2. 计算牌组前方连续空位数量。
3. 整组平移，保持内部顺序。
4. 用临时棋盘检查是否形成配对。
5. 成功提交，失败整组退回。

hasPlayableAction() 也会模拟直接消除和牌组推动。修改移动规则时必须同步验证它，否则会出现“实际能动但被判定死局”。

## 开局、刷新和倒计时

fresh() 生成新满盘、暂停计时并打开开始准备弹窗。准备页包含：

- 自由模式：只记录用时。
- 倒计时模式：输入 1–99 分钟。
- 开始游戏：隐藏准备页、启动计时和音乐。
- 刷新牌局：再次调用 fresh()，只换牌面，不启动计时。

倒计时状态由 gameMode 和 timeLimitSeconds 保存。updateClock() 每 500ms 更新顶部显示；到 0 时调用 endGame()。实际排行榜用时仍来自 elapsed()，即本局已经进行的秒数，不要只依赖 setTimeout，因为后台页面可能被浏览器降频。

## 暂停、死局和排行榜

计时依赖 paused、menuPaused、ended、animating。打开设置、排行榜或暂停弹窗前，先写入 elapsedBase = elapsed() 再暂停；恢复时通过现有恢复函数重置 startedAt，不要直接改一个变量。

checkGameState() 顺序：

1. 没有剩余牌：自动 endGame()，打开本局排行榜。
2. 有牌但 hasPlayableAction() 为假：暂停计时，打开死局弹窗。
3. 其他情况继续游戏。

排行榜有固定右上角关闭按钮；本局结算排行榜额外显示“再来一局”，因为排行榜会遮住底部棋盘按钮。普通排行榜关闭后返回打开前的页面。

## 存档格式和兼容性

snapshot() 当前保存：

~~~js
{
  grid: [["t0", null, ...]],
  hints: 3,
  bombs: 1,
  gameMode: "free" | "countdown",
  timeLimitSeconds: 180
}
~~~

请求还携带 saveId、clientId、playerName、score、elapsedSeconds、savedAt 和 gameState。

保存先写 localStorage，再 POST /api/save；网络失败时进入 mahjong-pending-saves，网络恢复或重新打开后由 syncPendingSaves() 上传。读取云端失败时合并本地存档，存档列表按时间倒序显示具体年月日和时间。

修改存档必须给旧字段默认值，保留 LEGACY_ID_MAP，并在 applySave() 兼容缺少新字段的旧存档。不能直接删除已有 D1 表或字段。

## Worker API 和 D1

麻将与凑十共用 game-data D1，但使用独立表：

- mahjong_saves：设备最新云存档。
- mahjong_save_history：每个设备最近 30 个历史存档。
- mahjong_scores：完成或结束的成绩。

接口：

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | /api/health | 健康检查 |
| GET | /api/leaderboard | 排行榜和记录 |
| GET | /api/saves?clientId=... | 当前设备的历史存档 |
| GET | /api/save?clientId=... | 最新或指定存档 |
| POST | /api/save | 保存进度 |
| POST | /api/end | 提交本局成绩 |

排行榜 SQL 的比较顺序是分数降序、用时升序、记录时间降序。修改字段时要同步修改 SQL 别名和前端展示。

## PWA 和离线模式

public/service-worker.js 当前缓存版本为 mahjong-shell-v4。核心缓存包含首页、参考入口、manifest、图标和参考图集；手动下载还包含背景音乐和消除音效。

导航使用缓存优先，保证飞行模式冷启动不等待网络。设置中的“下载离线版”通过 DOWNLOAD_OFFLINE 消息下载全部资源，CHECK_OFFLINE 检查完成状态。

每次改变首页、图集或离线资源后都要递增 CACHE_NAME，否则已安装到主屏幕的旧 Service Worker 可能继续返回旧首页。发布后需要联网打开一次，并重新点击“下载离线版”。

离线可用：开局、刷新、计时、消除、暂停、本机保存和本机加载。云存档上传、实时排行榜和提交结束成绩需要网络。

## UI 修改规范

- 保持 20×24 高密度布局。
- 牌为窄高矩形，不要改成正方形。
- 使用细灰色分割线、细棕色外框，不增加厚重立体阴影。
- 空位保留绿色底色和细参考线。
- board 必须保持 touch-action: none，避免 Safari 滚动或边缘返回手势抢走拖动。
- 保留禁用文字选择、长按菜单、双击缩放和横向溢出的触控保护。
- 设置、暂停、死局、重开、存档、排行榜打开时都要暂停计时。
- 长列表弹窗必须有始终可见的关闭入口。
- 新增按钮必须同时有 HTML 元素和事件绑定。

## 本地开发和验证

~~~bash
git clone https://github.com/th2006464/move-mahjong-hell.git
cd move-mahjong-hell
npm install
npx wrangler dev
~~~

直接打开 public/index.html 只能检查部分纯前端内容，云端 API、D1、Service Worker 和 PWA 冷启动应通过 Wrangler 地址验证。

提交前执行：

~~~bash
node -e "const fs=require('fs');const h=fs.readFileSync('public/index.html','utf8');[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(m=>new Function(m[1]));console.log('JavaScript OK')"
git diff --check
npx wrangler deploy --dry-run
~~~

最小回归清单：页面能加载 480 张牌；设置能打开；准备页能切换模式；刷新不启动计时；倒计时到 0 自动结束；同线无遮挡可直接消除；失败移动回退；连续牌组可推动；清空后排行榜有关闭和再来一局；存档能恢复模式和时间；参考域名仍显示图集；重新下载离线版后可飞行模式冷启动。

## 部署和数据库迁移

~~~bash
npx wrangler d1 migrations apply game-data --remote
npx wrangler deploy --dry-run
npx wrangler deploy
~~~

wrangler.jsonc 中包含 Worker、Assets、D1 和自定义域名配置。工作区中的 D1 配置可能有用户本地修改，除非明确要求，不要覆盖、重置或删除它。新增数据库结构必须增加 migration 文件，不要只在 Worker 代码中假设生产字段存在。

## 常见错误

### 页面白屏、设置无反应

主页面是单文件脚本，任何顶层 ReferenceError 都会阻止所有事件绑定。动态弹窗必须先创建并 append，再访问其内容；例如不能在 const startModal 声明前调用 startModal.querySelector(...)。

### 牌移动后消失或死局误判

检查移动临时状态和回退分支，再检查 hasPlayableAction() 是否与 moveGroup() 使用完全一致的模拟规则。

### iPhone 仍是旧版

检查 CACHE_NAME 是否递增；联网重新打开、等待更新提示并刷新，再重新执行“下载离线版”。

### 排行榜不是实时数据

离线时标题会标记“离线缓存”。先检查网络和 Service Worker，再检查 /api/leaderboard 的 D1 查询；不要把离线缓存误认为实时 D1 结果。

功能更新后应先更新代码和验证，再同步更新 README，并将相关文件一起推送到 main 分支。
