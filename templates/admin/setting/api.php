<?php echo $transition_page['control']; ?>
<!-- API页面设置 -->
<?php require_once(dirname(__DIR__).'/header.php'); ?>
<?php include_once(dirname(__DIR__).'/left.php'); ?>
<div class="layui-body">
<!-- 内容主体区域 -->
<div class="layui-row content-body place-holder">
    <!-- 说明提示框 -->
    <div class="layui-col-lg12">
      <div class="setting-msg">
        API Token 可用于浏览器扩展或自动化脚本。鉴权方式：请求参数 <code>token=md5(USER + SecretKey)</code> 或请求头 <code>X-Token</code>。
      </div>
    </div>
    <!-- 说明提示框END -->
    <div class="layui-col-lg6">
    <form class="layui-form layui-form-pane" action="">

        <div class="layui-form-item">
            <label class="layui-form-label" style = "width:130px;">用户名</label>
            <div class="layui-input-inline">
                <input style = "width:400px;" type="text" readonly="readonly" name="username" value = "<?php echo USER; ?>" autocomplete="off" placeholder="用户名" class="layui-input">
            </div>
        </div>

        <div class="layui-form-item">
            <label class="layui-form-label" style = "width:130px;">API域名</label>
            <div class="layui-input-inline">
                <input style = "width:400px;" type="text" readonly="readonly" id="api_domain" name="api_domain" autocomplete="off" placeholder="API域名" class="layui-input">
            </div>
        </div>

        <div class="layui-form-item">
            <label class="layui-form-label" style = "width:130px;">SecretKey</label>
            <div class="layui-input-inline">
                <input style = "width:400px;" type="text" readonly="readonly" name="SecretKey" id = "SecretKey" value = "<?php echo $SecretKey; ?>" autocomplete="off" placeholder="SecretKey" class="layui-input">
            </div>
            
        </div>

        <div class="layui-form-item">
            <label class="layui-form-label" style = "width:130px;">Token</label>
            <div class="layui-input-inline">
                <input style = "width:400px;" type="text" name="token" id="token" readonly="readonly" autocomplete="off" placeholder="点击下方按钮可以计算Token" class="layui-input">
            </div>
            
        </div>

        <div class="layui-form-item">
            <button class="layui-btn" lay-submit="" lay-filter="create_sk">生成SecretKey</button>
            <button class="layui-btn" lay-submit="" lay-filter="change_sk">更换SecretKey</button>
            <button class="layui-btn" lay-submit="" lay-filter="cal_token">计算Token</button>
            <button class="layui-btn" lay-submit="" lay-filter="one_copy" title="一键复制API域名和Token">一键复制</button>
        </div>

    </form>
    </div>
</div>
</div>
    
<?php include_once(dirname(__DIR__).'/footer.php'); ?>

<script>
function get_api_domain(){
    var api_domain = window.location.origin;
    $("#api_domain").val(api_domain);
}

get_api_domain();
</script>
