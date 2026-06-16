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
        AI 检索会把当前书签标题、URL、描述和您的提问发送到所配置的 OpenAI 兼容接口，请按自己的隐私策略选择服务商。
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
    <div class="layui-col-lg6">
    <style>
        .ai-provider-card {
            border: 1px solid #e6e6e6;
            border-radius: 6px;
            margin-bottom: 14px;
            padding: 14px 14px 2px 14px;
            background: #fff;
        }
        .ai-provider-head {
            align-items: center;
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
        }
        .ai-provider-title {
            color: #333;
            font-size: 15px;
            font-weight: 600;
        }
        .ai-provider-actions .layui-btn {
            margin-left: 6px;
        }
        .ai-provider-card .layui-form-label {
            width: 110px;
        }
        .ai-provider-card .layui-input-inline {
            width: calc(100% - 125px);
        }
        .ai-provider-card .layui-input-inline .layui-input,
        .ai-provider-card .layui-input-inline .layui-textarea {
            width: 100%;
        }
    </style>
    <form class="layui-form layui-form-pane" id="ai_provider_form" action="">

        <div class="layui-form-item">
            <label class="layui-form-label" style="width:130px;">AI状态</label>
            <div class="layui-input-inline">
                <input type="radio" name="status" value="on" title="启用" <?php echo ($ai_setting['status'] === 'on') ? 'checked' : ''; ?>>
                <input type="radio" name="status" value="off" title="关闭" <?php echo ($ai_setting['status'] !== 'on') ? 'checked' : ''; ?>>
            </div>
        </div>

        <div class="layui-form-item">
            <label class="layui-form-label" style="width:130px;">当前Provider</label>
            <div class="layui-input-inline">
                <select name="active_provider" id="active_provider" lay-filter="active_provider">
                    <?php foreach($ai_providers as $provider) { ?>
                    <option value="<?php echo htmlspecialchars($provider['id']); ?>" <?php echo ($ai_setting['active_provider'] === $provider['id']) ? 'selected' : ''; ?>><?php echo htmlspecialchars($provider['name']); ?></option>
                    <?php } ?>
                </select>
            </div>
        </div>

        <div id="ai_provider_list">
            <?php
            $models = [
                'gpt-4o' => 'OpenAI: gpt-4o',
                'gpt-4o-mini' => 'OpenAI: gpt-4o-mini',
                'deepseek-chat' => 'DeepSeek: deepseek-chat',
                'qwen-plus' => '通义千问: qwen-plus',
                'qwen-turbo' => '通义千问: qwen-turbo',
                'glm-4-air' => '智谱: glm-4-air',
                'deepseek-ai/DeepSeek-V3' => '硅基流动: DeepSeek-V3',
                'Qwen/Qwen2.5-72B-Instruct' => '硅基流动: Qwen2.5-72B',
                'auto' => '自动/服务端默认',
                'custom' => '自定义模型'
            ];
            foreach($ai_providers as $index => $provider) {
            ?>
            <div class="ai-provider-card" data-index="<?php echo intval($index); ?>">
                <div class="ai-provider-head">
                    <div class="ai-provider-title"><?php echo htmlspecialchars($provider['name']); ?></div>
                    <div class="ai-provider-actions">
                        <button type="button" class="layui-btn layui-btn-primary layui-btn-sm test-ai-provider">测试连接</button>
                        <button type="button" class="layui-btn layui-btn-danger layui-btn-sm remove-ai-provider">删除</button>
                    </div>
                </div>

                <input type="hidden" name="providers[<?php echo intval($index); ?>][id]" value="<?php echo htmlspecialchars($provider['id']); ?>" class="ai-provider-id">

                <div class="layui-form-item">
                    <label class="layui-form-label">名称</label>
                    <div class="layui-input-inline">
                        <input type="text" name="providers[<?php echo intval($index); ?>][name]" value="<?php echo htmlspecialchars($provider['name']); ?>" autocomplete="off" placeholder="例如 OpenAI、DeepSeek、本地模型" class="layui-input ai-provider-name">
                    </div>
                </div>

                <div class="layui-form-item">
                    <label class="layui-form-label">说明</label>
                    <div class="layui-input-inline">
                        <input type="text" name="providers[<?php echo intval($index); ?>][description]" value="<?php echo htmlspecialchars($provider['description']); ?>" autocomplete="off" placeholder="例如 GPT-4o、内网 Ollama、硅基流动等" class="layui-input">
                    </div>
                </div>

                <div class="layui-form-item">
                    <label class="layui-form-label">Base URL</label>
                    <div class="layui-input-inline">
                        <input type="text" name="providers[<?php echo intval($index); ?>][url]" value="<?php echo htmlspecialchars($provider['url']); ?>" autocomplete="off" placeholder="https://api.openai.com/v1 或完整 /chat/completions 地址" class="layui-input ai-provider-url">
                    </div>
                </div>

                <div class="layui-form-item">
                    <label class="layui-form-label">API Key</label>
                    <div class="layui-input-inline">
                        <input type="password" name="providers[<?php echo intval($index); ?>][sk]" value="<?php echo htmlspecialchars($provider['sk']); ?>" autocomplete="off" placeholder="sk-..." class="layui-input ai-provider-key">
                        <input type="checkbox" class="show-ai-provider-key" title="显示 API Key" lay-filter="show_ai_provider_key">
                    </div>
                </div>

                <div class="layui-form-item">
                    <label class="layui-form-label">模型</label>
                    <div class="layui-input-inline">
                        <select name="providers[<?php echo intval($index); ?>][model]" class="ai-provider-model" lay-filter="ai_provider_model" lay-search>
                            <option value="">请选择模型</option>
                            <?php
                            foreach($models as $value => $label) {
                                $selected = ($provider['model'] === $value) ? 'selected' : '';
                                echo '<option value="'.htmlspecialchars($value).'" '.$selected.'>'.htmlspecialchars($label).'</option>';
                            }
                            ?>
                        </select>
                    </div>
                </div>

                <div class="layui-form-item ai-custom-model-item" style="<?php echo ($provider['model'] === 'custom') ? '' : 'display:none;'; ?>">
                    <label class="layui-form-label">自定义模型</label>
                    <div class="layui-input-inline">
                        <input type="text" name="providers[<?php echo intval($index); ?>][custom_model]" value="<?php echo htmlspecialchars($provider['custom_model']); ?>" autocomplete="off" placeholder="例如 qwen2.5:72b、doubao-1-5-pro-32k-250115" class="layui-input ai-provider-custom-model">
                    </div>
                </div>
            </div>
            <?php } ?>
        </div>

        <div class="layui-form-item">
            <button type="button" class="layui-btn layui-btn-primary" id="add_ai_provider">添加Provider</button>
            <button class="layui-btn layui-btn-normal" lay-submit="" lay-filter="set_ai_setting">保存AI设置</button>
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
