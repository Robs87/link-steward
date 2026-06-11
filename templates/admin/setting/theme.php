<!-- 主题设置 -->
<?php require_once(dirname(__DIR__).'/header.php'); ?>
<?php include_once(dirname(__DIR__).'/left.php'); ?>
<div class="layui-body">
<!-- 内容主体区域 -->
<div class="layui-row content-body place-holder" id = "layer-photos">
    <!-- 说明提示框 -->
    <div class="layui-col-lg12">
      <div class="setting-msg">
        <p>1. 可在这里切换已安装主题，并调整主题参数。</p>
        <p>2. 在线主题商店和上游订阅下载入口已移除；新增主题请直接放入 <code>templates/</code> 或 <code>data/templates/</code>。</p>
        <p>3. 部分主题来自其它开源项目，请保留对应主题目录内的许可证和说明。</p>
      </div>
    </div>
    <!-- 说明提示框END -->
    <div class="layui-col-lg12">
        <div class="layui-row layui-col-space24">
        
        <!-- 主题设置 -->
        <div class="setting">
            <form class="layui-form layui-form-pane" lay-filter="themes" action="">
                <div class="layui-form-item">
                    <div class="layui-inline">
                        <label class="layui-form-label">PC主题</label>
                        <div class="layui-input-inline">
                        <select name="pc_theme" lay-filter="aihao">
                            <?php foreach ($themes as $key => $theme) { ?>
                                <option value="<?php echo $key; ?>"><?php echo $key; ?></option>
                            <?php } ?>
                        </select>
                        </div>
                    </div>
                    <div class="layui-inline">
                        <label class="layui-form-label">手机主题</label>
                        <div class="layui-input-inline">
                        <select name="mobile_theme" lay-filter="aihao">
                            <?php foreach ($themes as $key => $theme) { ?>
                                <option value="<?php echo $key; ?>"><?php echo $key; ?></option>
                            <?php } ?>
                        </select>
                        </div>
                    </div>
                    <div class="layui-inline">
                        <button class="layui-btn" lay-submit lay-filter="s_themes">保存</button>
                    </div>
                </div>
            </form>
        </div>
        <!-- 主题设置选项 -->

        <h2>已下载</h2>

            <!-- 主题列表new -->
            <?php foreach ($themes as $key => $theme) {
                //var_dump($theme['info']->name);
            ?>
            <div class="layui-col-md3">
                <div class="layui-card custom-card">
                    <div class="layui-card-header" id="<?php echo $key; ?>">
                        <div class="them-header">
                            <div class="left">
                                <span class = "name"><?php echo $key; ?> - <?php echo $theme['info']->version ?></span>
                                <?php if( $current_them == $key ) { ?>
                                    <!-- <span style = "color:#ff5722;">（使用中）</span> -->
                                <?php } ?>
                            </div>
                            <div class="right">
                                <span class="renewable" style="color:#FF5722;font-size:14px;"></span>
                            </div>
                        </div>
                        

                    </div>
                    <div class="layui-card-body">
                        <!-- 主题图片 -->
                        <div class = "screenshot">
                            <p><img layer-src="<?php echo $theme['info']->screenshot; ?>" src="<?php echo $theme['info']->screenshot; ?>" alt=""></p>
                            
                        </div>
                        
                        <!-- 主题图片END -->
                        <hr>
                        <div class = "thme-btns">
                            <div class="layui-btn-group">
                                <!-- <button type="button" class="layui-btn layui-btn-sm" onclick = "set_theme('<?php echo $key; ?>')">使用</button> -->
                                <button type="button" class="layui-btn layui-btn-sm" onclick = "theme_detail('<?php echo $key; ?>')">详情</button>
                                <button type="button" class="layui-btn layui-btn-sm" onclick = "theme_config('<?php echo $key; ?>')">参数设置</button>
                                <a class="layui-btn layui-btn-sm" target = "_blank" href="/index.php?theme=<?php echo $key;  ?>">预览</a>
                                <button type="button" class="layui-btn layui-btn-sm layui-btn-danger" onclick = "delete_theme('<?php echo $key; ?>')">删除</button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
            <?php } ?>
            <!-- 主题列表new END -->

        </div>
    </div>
</div>
</div>
<?php include_once(dirname(__DIR__).'/footer.php'); ?>
<script>
layui.use(['layer','form'], function(){
    var layer = layui.layer;
    var form = layui.form;

    // 监听主题设置的提交
    form.on('submit(s_themes)', function(data){
        //console.log(data.field);
        let value = JSON.stringify(data.field);
        $.post("/index.php?c=api&method=set_theme",{value:value},function(res){
            if( res.code == 0 ) {
                layer.msg(res.data, {icon: 1});
                // setTimeout(() => {
                //     location.reload();
                // }, 2000);
            }
            else{
                layer.msg(res.err_msg, {icon: 5});
            }
        });
        return false; //阻止表单跳转。如果需要表单跳转，去掉这段即可。
    });

    // 请求API接口获取当前设置的主题
    $.get("/index.php?c=api&method=get_themes",function(data,status){
        if( data.code == 200 ) {
            let value = data.data;
            //console.log(themes);
            //设置主题下拉框的值
            form.val('themes', {
                'pc_theme': value.pc_theme,
                'mobile_theme': value.mobile_theme
            });
        }
        else{
            layer.msg(data.err_msg, {icon: 5});
        }
    });
});
function theme_detail(name){
    layer.open({
        title: name,
        type:2,
        area: ['1200px', '680px'],
        content:'/index.php?c=admin&page=setting/theme_detail&name=' + name
    });   
}

function theme_detail_online(name){
    layer.open({
        title: name,
        type:2,
        area: ['1200px', '680px'],
        content:'/index.php?c=admin&page=setting/theme_detail&name=' + name
    });   
}
//主题参数设置
function theme_config(name){
    layer.open({
        title: "设置主题【" + name + "】参数：",
        type:2,
        area: ['620px', '560px'],
        content:'/index.php?c=admin&page=setting/theme_config&name=' + name
    });
}

function set_theme(name) {
    $.post("/index.php?c=api&method=set_theme",{key:"theme",value:name},function(data,status){
        if( data.code == 0 ) {
            layer.msg(data.data, {icon: 1});
            setTimeout(() => {
                location.reload();
            }, 2000);
        }
        else{
            layer.msg(data.err_msg, {icon: 5});
        }
    });
}

layer.photos({
  photos: '#layer-photos'
  ,anim: 5 //0-6的选择，指定弹出图片动画类型，默认随机（请注意，3.0之前的版本用shift参数）
}); 
</script>
