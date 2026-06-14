# 旅行纪念网页生成器

这是一个纯静态的客户旅行纪念网页生成器，适合部署在 GitHub Pages / Cloudflare Pages。

## 重要结论

GitHub Pages 只能托管静态文件，不能直接接收上传、不能在服务器上自动创建客户文件夹，也不能保存客户照片/视频/GPX。

所以最简单、免费、适合新手的方案是：

1. 用 `admin.html` 在浏览器本地生成客户页面文件夹。
2. 把生成的 `customers/客户路径/` 上传或推送到 GitHub。
3. GitHub Pages 自动生成客户专属网址。
4. 把这个网址写入 NFC 芯片。

这个方案不需要收费服务，也不需要复杂后端。

## 文件说明

- `admin.html`：管理页面，用来上传素材、填写信息、生成客户网页。
- `template.html`：客户页面模板。
- `generator.js`：生成器逻辑和客户页渲染逻辑。
- `style.css`：管理页和客户页共用样式。
- `data/sample.json`：示例数据。
- `data/sample.gpx`：示例 GPX 轨迹。
- `customers/sample-tibet-2026/`：示例客户页面。

## 以后接单怎么操作

1. 打开 `admin.html`。
2. 上传客户照片、视频、GPX 文件。
3. 填写客户名称、标题、日期、地点、起点、终点、距离、海拔等信息。
4. 点击“生成网页”。
5. 点击“保存到本地项目文件夹”，选择当前项目根目录。
6. 生成后会出现类似：

   ```text
   /customers/kulagangri-2026/index.html
   ```

7. 把新生成的 `customers/客户路径/` 提交并推送到 GitHub。
8. 客户网址就是：

   ```text
   https://zhpnncjdsg.github.io/tibetan-trail-memory/customers/客户路径/
   ```

9. 把这个网址写入 NFC 芯片。

## 示例页面

本项目自带一个示例客户页面：

```text
customers/sample-tibet-2026/index.html
```

上线后对应网址：

```text
https://zhpnncjdsg.github.io/tibetan-trail-memory/customers/sample-tibet-2026/
```

## 路线动画

客户页使用 Leaflet.js + OpenStreetMap，不使用收费 API。

支持：

- 读取 GPX 文件
- 显示徒步路线
- 路线从起点逐渐画到终点
- 小圆点沿路线移动
- 起点和终点标记
- 点击按钮重播动画

## 推荐发布方式

当前项目已经使用 GitHub Pages。

如果你想更快、国内访问更稳定，可以以后迁移到 Cloudflare Pages 或国内 OSS/COS。但最少操作版本继续用 GitHub Pages 就可以。

## 注意事项

- 照片和视频会公开在网页链接中，拿到链接的人都能看。
- 视频文件不要太大，否则 GitHub Pages 加载会慢。
- 每个客户一个独立文件夹，方便把不同链接写入不同 NFC 芯片。
