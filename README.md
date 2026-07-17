# OVIS Device Manager

OVIS 设备管理网页，提供设备发现、连接、断线检测和设备配置。

## 本地开发

```bash
npm install
npm run dev
```

网页会并发探测 `192.168.42.1` 至 `192.168.57.1` 的设备接口，每个地址
使用 `8080/api/v1/device/info`。地址池定义在
`src/features/device/device.api.ts`，搜索结果不会写入 `localStorage`。

连接设备后，网页从选中设备的 `apiBaseUrl` 读取配置能力和当前配置，支持
视频码流、OSD 与智能检测参数的校验、保存、应用、任务轮询和恢复默认。
当前配置接口不携带登录或认证信息。

配置应用期间会把设备 ID、地址、任务 ID、目标 revision 和开始时间保存到
`sessionStorage`。设备重启断网后，网页只重连相同 `device_id`，并在 90 秒内
通过任务结果和配置 revision 确认应用或回滚；刷新页面不会中断该流程。

## 构建

```bash
npm run build
```

Vite 和 GitHub Pages 部署均使用根路径 `/`，用于自定义域名
`ovis.aimorelogy.com`。仓库通过 GitHub Actions 发布，因此自定义域名应在
仓库的 `Settings > Pages > Custom domain` 中配置，而不是依赖仓库内的
`CNAME` 文件。
