# 挪对对 · 地狱模式

一个移动端优先的麻将滑动配对解谜小游戏复刻。

## 已实现

- 12×16 高密度随机棋盘，少量初始空位
- 相同麻将沿无遮挡横/纵直线移动并配对消除
- 提示、洗牌、炸弹、重开
- 无倒计时地狱模式与通关/死局提示
- D1 云存档、本地备用存档、排行榜与本局用时
- 每消除一对获得 1 分，同分按完成用时排序
- Cloudflare Pages / Workers 静态资源结构

## 本地运行

直接打开 `public/index.html`，或使用 `wrangler dev`。

## 在线地址

https://move-mahjong-hell.game.foxtang.com
