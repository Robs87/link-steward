<!-- 系统维护 -->
<?php require_once(dirname(__DIR__).'/header.php'); ?>
<?php include_once(dirname(__DIR__).'/left.php'); ?>
<div class="layui-body">
<!-- 内容主体区域 -->
<div class="layui-row content-body place-holder" style="padding-bottom: 3em;">
    <div class="layui-col-lg12">
      <div class="setting-msg">
        <ol>
            <li>Link Steward 已移除上游外部服务入口。</li>
            <li>原订阅限制功能已在本地开源版中开放：自定义页脚、过渡页广告、书签分享、数据库备份、AI 检索、批量链接检测等。</li>
            <li>为了避免覆盖本地改动，远程一键更新入口已移除；请通过 Git 或容器镜像更新实例。</li>
        </ol>
      </div>
    </div>

    <div class="layui-col-lg6">
        <h2 style="margin-bottom:1em;">系统信息</h2>
        <form class="layui-form layui-form-pane" action="">
            <div class="layui-form-item">
                <label class="layui-form-label">当前版本</label>
                <div class="layui-input-block">
                    <input type="text" readonly="readonly" id="current_version" name="current_version" value="<?php echo $current_version; ?>" class="layui-input">
                </div>
            </div>
            <div class="layui-form-item">
                <label class="layui-form-label">功能状态</label>
                <div class="layui-input-block">
                    <input type="text" readonly="readonly" value="本地高级功能已启用" class="layui-input">
                </div>
            </div>
        </form>
    </div>

    <div class="layui-col-lg12" style="margin-top:1em;">
        <div class="layui-collapse">
            <div class="layui-colla-item">
                <h2 class="layui-colla-title">维护建议</h2>
                <div class="layui-colla-content layui-show">
                    <p>更新前请先到“数据备份”页面创建备份；如果使用 Docker/Unraid，请拉取新镜像并重建容器。</p>
                </div>
            </div>
        </div>
    </div>
</div>
</div>

<?php include_once(dirname(__DIR__).'/footer.php'); ?>
