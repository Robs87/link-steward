<?php
//载入数据库配置
require 'class/Medoo.php';
use Medoo\Medoo;
$db = new medoo([
    'database_type' => 'sqlite',
    'database_file' => 'data/onenav.db3'
]);

//用户名
define('USER','{username}');
// 加密后的密码
define('ENCRYPTED_PASSWORD','{encrypted_password}');
//邮箱，用于后台Gravatar头像显示
define('EMAIL','{email}');
//主题风格,0.9.18废弃了，请通过后台设置
define('TEMPLATE','default');

//站点信息
$site_setting = [];
//站点标题
$site_setting['title']          =   'Link Steward';
//文字Logo
$site_setting['logo']          =   'Link Steward';
//站点关键词
$site_setting['keywords']       =   'Link Steward,书签管理,开源导航,开源书签,个人导航,个人书签';
//站点描述
$site_setting['description']    =   'Link Steward 是一款使用 PHP + SQLite3 开发的自托管书签管理器。';

//这两项不要修改
$site_setting['user']           =   USER;
$site_setting['password']       =   ENCRYPTED_PASSWORD;
