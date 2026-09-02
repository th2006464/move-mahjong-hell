# 挪对对 · 地狱模式

一个移动端优先的《挪对对》地狱模式复刻，使用 Cloudflare Workers + D1 部署。

## 功能

- 20×24 高密度随机棋盘，开局满屏铺牌
- 同行/同列且中间无遮挡的相同麻将，点击即可直接消除
- 单张麻将支持横向/纵向滑动，按滑动距离移动对应格数
- 选中麻将后点击目标空位，连续相邻牌可作为牌组整体移动
- 移动动画、黄框选中、提示遮罩与消除反馈
- 提示、洗牌、炸弹、重开
- 每消除一对获得 1 分，记录本局用时
- D1 云存档、本地备用存档、排行榜与玩家昵称
- Safari 双击缩放保护

## 本地运行

```bash
npm install
npx wrangler dev
```

也可以直接打开 `public/index.html` 体验纯前端版本。

## 部署

```bash
npx wrangler d1 migrations apply sum-ten-game-data --remote
npx wrangler deploy --minify
```

项目使用现有的 `sum-ten-game-data` D1 数据库，并新增：

- `mahjong_saves`：云端进度
- `mahjong_scores`：排行榜成绩

## 在线地址

[move-mahjong-hell.game.foxtang.com](https://move-mahjong-hell.game.foxtang.com)

## GitHub

[github.com/th2006464/move-mahjong-hell](https://github.com/th2006464/move-mahjong-hell)
