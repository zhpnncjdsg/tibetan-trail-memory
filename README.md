# 旅行纪念网页生成器

这是一个部署在 GitHub Pages 上的旅行纪念网页生成器。

目标流程：

```text
上传资料
填写文字
点击生成并发布
自动上传到 GitHub
得到客户网页链接
写入 NFC
```

## 在线入口

管理页：

```text
https://zhpnncjdsg.github.io/tibetan-trail-memory/admin.html
```

示例客户页：

```text
https://zhpnncjdsg.github.io/tibetan-trail-memory/customers/sample-tibet-2026/
```

## GitHub Pages 能不能直接保存上传文件？

不能。

GitHub Pages 只能托管静态文件，不能像后台系统一样接收上传并保存文件。

本项目的做法是：

1. `admin.html` 在浏览器里读取你上传的照片、视频、GPX。
2. 浏览器用你填写的 GitHub Token 调用 GitHub API。
3. GitHub API 把文件提交到仓库：

   ```text
   customers/trip-日期-随机编号/
   ```

4. GitHub Pages 自动把这个文件夹变成客户网页。

这样不需要收费服务，也不需要复杂后端。

## 仓库配置

当前固定使用：

```text
owner: zhpnncjdsg
repo: tibetan-trail-memory
branch: main
```

客户页面最终地址格式：

```text
https://zhpnncjdsg.github.io/tibetan-trail-memory/customers/客户文件夹名/index.html
```

示例：

```text
https://zhpnncjdsg.github.io/tibetan-trail-memory/customers/trip-20260614-a8f3c2/index.html
```

## 创建 GitHub Fine-grained Token

GitHub 官方文档：

```text
https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
```

创建步骤：

1. 打开 GitHub。
2. 点击右上角头像。
3. 进入 `Settings`。
4. 左侧进入 `Developer settings`。
5. 进入 `Personal access tokens`。
6. 选择 `Fine-grained tokens`。
7. 点击 `Generate new token`。
8. Token name 可填：

   ```text
   memory-page-generator
   ```

9. Expiration 建议选择一个明确日期，例如 90 天或 180 天。
10. Resource owner 选择：

   ```text
   zhpnncjdsg
   ```

11. Repository access 选择：

   ```text
   Only select repositories
   ```

12. Selected repositories 只选择：

   ```text
   tibetan-trail-memory
   ```

13. Permissions 里只设置：

   ```text
   Repository permissions
   Contents: Read and Write
   ```

14. 其他权限保持默认，不要额外打开。
15. 点击生成 token。
16. 复制 token，粘贴到 `admin.html` 的 Token 输入框。

注意：

- Token 只会保存在当前浏览器的 `localStorage`。
- Token 不会写入网页代码。
- Token 不会提交到 GitHub 仓库。
- 如果换电脑或换浏览器，需要重新粘贴一次 token。

## 接单后怎么操作

1. 打开：

   ```text
   https://zhpnncjdsg.github.io/tibetan-trail-memory/admin.html
   ```

2. 上传客户照片，多张。
3. 上传客户视频，可选。
4. 上传 GPX 轨迹文件，可选。
5. 填写：

   - 客户名称
   - 页面标题
   - 副标题
   - 徒步地点
   - 徒步日期
   - 起点
   - 终点
   - 徒步距离
   - 最高海拔
   - 累计爬升
   - 页面风格
   - 定制说明

6. 填写 GitHub Token。
7. 点击：

   ```text
   生成并发布
   ```

8. 等待上传完成。
9. 页面会显示最终客户链接。
10. 点击“复制链接”。
11. 把链接写入 NFC 芯片。

## 自动生成的路径

系统会自动生成安全英文路径，不使用中文路径。

格式：

```text
customers/trip-YYYYMMDD-随机编号/
```

例如：

```text
customers/trip-20260614-a8f3c2/
```

## 上传到 GitHub 的文件

每个客户会自动上传：

```text
customers/客户文件夹名/index.html
customers/客户文件夹名/data.json
customers/客户文件夹名/route.gpx
customers/客户文件夹名/assets/photos/photo-01.jpg
customers/客户文件夹名/assets/photos/photo-02.jpg
customers/客户文件夹名/assets/videos/...
```

照片会在浏览器里自动压缩成适合手机网页浏览的 JPEG。

视频不会自动压缩。建议单条视频尽量控制在 50MB 以下；GitHub 不适合放很大的视频文件。

## 路线动画

客户页使用：

- Leaflet.js
- OpenStreetMap

不使用收费 API。

支持：

- 读取 GPX
- 显示徒步路线
- 路线从起点逐渐画到终点
- 小圆点沿路线移动
- 起点和终点标记
- 点击按钮重播动画

## 注意事项

- 这个仓库是公开仓库，客户链接和图片理论上任何拿到链接的人都可以访问。
- 如果客户照片需要隐私保护，应改用私有存储或带权限的托管方案。
- GitHub Pages 在国内访问可能偏慢，NFC 可用，但速度取决于网络。
