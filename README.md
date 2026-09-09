# 挪对对 · 地狱模式

一个移动端优先的麻将滑动配对解谜游戏，仅保留高密度、低容错的地狱模式。项目使用原生 HTML、CSS 和 JavaScript 实现，后端运行于 Cloudflare Workers，进度和排行榜数据存储在 Cloudflare D1。

## 在线体验

[move-mahjong-hell.game.foxtang.com](https://move-mahjong-hell.game.foxtang.com)

## 当前版本

- 20 列 × 24 行，共 480 个格子
- 每局随机生成，开局满屏铺牌，不预留空位
- 万、条、饼、风牌和三元牌使用完整麻将牌面显示
- 棋盘贴合屏幕宽度，采用紧凑分隔和放大牌面，提升手机触控辨识度
- 点击选择麻将时不显示额外高亮框，保持棋盘牌面干净统一
- 消除后的空格保留细参考线，方便沿行列判断移动落点
- 移动端优先，同时支持鼠标和触摸操作
- 无倒计时失败；记录本局实际用时

## 核心规则

### 直接消除

点击任意麻将后，系统会寻找同行或同列的相同麻将。只要两张牌之间没有其他麻将阻挡，无论是否紧挨，都可以直接消除。

### 单张拖动

按住麻将向上、下、左、右拖动，麻将会跟随手指移动，并在松手时停到对应格子。移动只能沿直线进行，不能斜向移动，也不能穿过其他牌。

### 连续牌组推动

如果拖动方向上紧挨着其他麻将，选中的麻将以及该方向上的连续牌会作为一个整体被推动：

- 可以从一行或一列中的任意麻将开始推动
- 牌组保持原有顺序，不会互相穿越
- 拖动几格，整组就移动几格
- 最大移动距离由牌组前方的连续空位数量决定
- 横向和纵向使用相同规则

也可以先点击一张麻将，再点击同行或同列、位于连续牌组外侧的目标空位，完成同样的整体移动。

### 自动消除

移动完成后，系统会重新检查所有被移动的麻将。若某张牌与另一张相同麻将处于同行或同列，且中间没有障碍，则自动消除。每消除一对获得 1 分。

移动只有在能够立即触发至少一对消除时才会生效；如果移动后没有形成配对，单张麻将或连续牌组会自动退回原位，棋盘状态和分数均保持不变。

## 游戏功能

- **提示**：高亮一组当前可以直接消除的麻将
- **洗牌**：随机打乱棋盘上所有剩余麻将的位置
- **暂停/继续**：暂停时冻结本局计时并锁定棋盘，点击弹窗中的继续按钮恢复游戏和计时
- **重开**：生成一盘新的满屏随机棋盘
- **保存进度**：保存牌面、分数、道具数量、本局用时和保存时间，保留最近 30 个历史存档
- **加载进度**：按年月日和具体时间选择云端历史存档，网络不可用时可读取本地备用存档
- **结束游戏**：提交当前分数和用时并展示排行榜
- **排行榜**：展示前 20 名，优先比较分数，同分时用时更短者靠前
- **背景音乐**：进入游戏后循环播放；若浏览器限制自动播放，会在首次操作时开始
- **消除音效**：每次成功配对消除时播放反馈音
- **Safari 适配**：抑制边缘横滑导航、双击缩放、文字选择和长按菜单误触

## 技术结构

```text
move-mahjong-hell/
├── public/index.html                       # 游戏界面、规则和交互
├── public/audio/                           # 背景音乐与消除音效
├── src/index.js                            # Worker API 与静态资源入口
├── migrations/0001_mahjong_progress_and_scores.sql
├── migrations/0002_mahjong_save_history.sql
├── wrangler.jsonc                          # Worker、D1 与自定义域名配置
└── package.json
```

后端提供以下接口：

- `GET /api/health`：服务健康检查
- `GET /api/leaderboard`：获取排行榜
- `GET /api/saves`：获取当前设备的历史存档列表
- `GET /api/save`：读取当前设备的云端存档
- `POST /api/save`：保存当前游戏进度
- `POST /api/end`：提交本局成绩

## 本地运行

需要 Node.js 和 npm。

```bash
git clone https://github.com/th2006464/move-mahjong-hell.git
cd move-mahjong-hell
npm install
npx wrangler dev
```

随后打开 Wrangler 输出的本地地址。直接打开 `public/index.html` 也可以体验纯前端玩法，但云存档和排行榜接口不可用。

## D1 数据库

项目复用现有的 `sum-ten-game-data` D1 数据库，并使用三张独立数据表：

- `mahjong_saves`：玩家云端进度
- `mahjong_save_history`：带保存时间的历史进度
- `mahjong_scores`：排行榜成绩

首次部署前执行迁移：

```bash
npx wrangler d1 migrations apply sum-ten-game-data --remote
```

## 部署

Worker、静态资源、D1 绑定和自定义域名均已在 `wrangler.jsonc` 中配置。

```bash
npx wrangler deploy --dry-run
npx wrangler deploy --minify
```

生产域名：`move-mahjong-hell.game.foxtang.com`

## 项目地址

[github.com/th2006464/move-mahjong-hell](https://github.com/th2006464/move-mahjong-hell)
