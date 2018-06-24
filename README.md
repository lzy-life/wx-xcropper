# xCropper

@(关键词)[小程序|图片裁切|多比例|多尺寸|多图]

**xCropper**是一款专为微信小程序开发的图片裁切组件，通过精心的设计与技术实现，配合小程序强大的功能，带来前所未有的裁切体验。特点概述：
 
- **功能丰富** ：支持图片缩放和拖动；支持裁切框缩放和拖动；支持多种裁切比例；支持多种裁切尺寸；支持多种裁切模式；支持多张图片依次裁切；
- **操作简单** ：多张图片一次裁切，每张图片可选择不同裁切比例；一次选择裁切出多种尺寸
- **配置简单** ：引入组件，配置一个参数即可使用裁切组件

-------------------

[TOC]

## xCropper简介

> 图片裁切是一个非常普通功能，然而微信小程序原生并没有提供；从网上找了几个图片裁切插件功能也都比较简单，且存在各种小问题；因此决定自己尝试开发一个[xCropper](https://github.com/lzy-life/wx-xcropper/)组件，也是抱着抛砖引玉的想法提交到GitHub上，希望大家一起努力完善。    

### 使用
Clone源代码，从 `components` 目录中把 `xcropper` 目录复制到你的项目中，在需要使用该组件的页面引入组件，在 `wxml` 中使用即可。

### 示例代码
`index.js`
``` javascript
Page({
  data: {
    images: null, // 裁切完的图片
    enableCropper: false, // 是否启用裁切
    cutImages: null, // 需要裁切的图片
    cropperOpts: { // 裁切的配置
      boxX: 10,
      boxY: 195,
      // boxOffsetX: 10,
      // boxOffsetY: 10,
      boxW: 200,
      boxH: 170,
    }
  },
  onLoad: function () {
    //
  },
  chooseImage: function(evt) {
    let self = this;
    wx.chooseImage({
      count: 9, // 最大图片数量
      sizeType: ["original", "compressed"],
      sourceType: ["album", "camera"],
      success: function (res) {
        self.setData({
          enableCropper: true,
          cutImages: res.tempFilePaths
        });
      },
      fail: function (res) {
        console.warn(res);
      }
    });
  },
  success: function (evt) {
    let ret;
    if (Array.isArray(evt.detail)) {
      ret = evt.detail;
    } else {
      ret = evt.detail.path;
      // 测试返回的图片尺寸是否正确
      wx.getImageInfo({
        src: evt.detail.path,
        success(res) {
          console.log(res);
        }
      });
    }
    this.setData({
      enableCropper: false,
      cutImages: null,
      images: ret
    });
  },
  failure: function (evt) {
    this.setData({
      cutImages: null,
      enableCropper: false
    });
  },
})
```

`index.wxml`
``` html
<!-- 显示内容 -->
<view class="container" wx:if="{{!enableCropper}}">
  <block wx:if="{{m.isArray(images)}}" wx:for="images" wx:for-item="img" wx:for-index="i" wx:key="{{i}}">
    <image src='{{img.path}}' mode='widthFix'></image>
  </block>
  <block wx:if="{{m.isString(images)}}">
    <image src='{{images}}' mode='widthFix'></image>
  </block>
  <block wx:if="{{m.isEmpty(images)}}">
    <text>请选择要裁切的图片</text>
  </block>
  <button class='btn' bindtap='chooseImage'>选择图片</button>
</view>
<!-- 裁切组件 -->
<view class='cropper-wrapper' wx:if="{{enableCropper}}">
  <xcropper wx:if="{{cutImages}}" images="{{cutImages}}" cropperOpts="{{cropperOpts}}" bind:success="success" bind:failure="failure"></xcropper>
</view>
<!-- 辅助函数 -->
<wxs module="m">
  function isArray(arg) {
    return arg && typeof arg == "object" && typeof arg.splice == "function";
  }
  function isString(arg) {
    return arg && typeof arg == "string";
  }
  function isEmpty(arg) {
    return arg === null || arg === undefined || arg === "";
  }
  module.exports.isArray = isArray;
  module.exports.isString = isString;
  module.exports.isEmpty = isEmpty;
</wxs>
```

`index.wxss`
``` css
page, .cropper-wrapper{
  width: 100%;
  height: 100%;
}
```

`index.json`
``` json
{
  "usingComponents": {
    "xcropper": "/components/xcropper/xcropper"
  }
}
```


### 组件参数说明
|     名称     |          数据类型          | 是否必要 |              描述             |
| :----------: | :------------------------: | :-----: | :---------------------------: |
|     images   | String/Array&lt;String&gt; |  **Y**  |   需要裁切的图片路径或路径数组   |
|  cropperOpts |           Object           |   *N*   | 裁切选取框配置参数，如位置、大小 |
| bind:success |          Function          |  **Y**  | 裁切成功的回调函数，临时文件路径通过`evt.detail`获取，多图`[{size:xxx,path:"xxx"}]`，单图`{size:xxx,path:"xxx"}` |
| bind:failure |          Function          |  **Y**  | 裁切失败的回调函数 |

#### cropperOpts参数说明
|    名称    |            类型            |    默认值   |                                     描述                                     |
| :--------: | :-----------------------: | :---------: | :-------------------------------------------------------------------------: |
|    boxX    |          Number           |  undefined  |              选取框的X轴坐标，相对屏幕左上角(优先`boxOffsetX`参数)             |
|    boxY    |          Number           |  undefined  |              选取框的Y轴坐标，相对屏幕左上角(优先`boxOffsetY`参数)             |
| boxOffsetX |          Number           |  undefined  |                         选取框在图片左上角的X轴偏移值                         |
| boxOffsetY |          Number           |  undefined  |                         选取框在图片左上角的Y轴偏移值                         |
|    boxW    |          Number           |     320,    |                                  选取框的宽                                  |
|    boxH    |          Number           |     320     |                                  选取框的高                                  |
|   ratio    |          Number           |      1      |                                 裁切的宽高比                                 |
|    mode    |          String           |   "ratio"   | 裁切的模式: ratio-比例裁切,以原图尺寸等比裁切; size-尺寸裁切,以选取框尺寸倍数裁切 |
| ~~shape~~  |          String           | "rectangle" |                   裁切的形状: rectangle: 矩形; circle: 圆形                   |
|   sizes    | Number/Array&lt;Number&gt |  undefined  |                       生成图片的尺寸（此时裁切模式无效）                       |

> **提示：**想了解更多，请查看源码，注释超级详细。

## 截屏
![单图裁切](https://github.com/lzy-life/wx-xcropper/raw/master/screenshots/1.png)
![多图裁切](https://github.com/lzy-life/wx-xcropper/raw/master/screenshots/2.png)


## 说明
裁切形状(`cropperOpts.shape`)参数目前无效，因将生成的图像中挑出不在形状范围内的像素点扣掉太麻烦、太耗性能目前没实现。

## 问题

### 裁切选取框不流畅
缩放裁切选取框时，定位不准确；因为裁切选取框四个拖拽缩放时，都是单一的处理X轴或Y轴，没有两个一起轴一起判断。

### 指定裁切多个尺寸无反应
当配置了 `cropperOpts` 的 `sizes` 为数字数组时，则意为着将每张图片都裁切生成数组指定的多个尺寸。
裁切方法返回 `Promise` 对象；当指定裁切多个尺寸时使用 `[].forEach` 多次调用裁切方法，将返回的多个 `Promise` 对象放入一个数组中，再使用 `Promise.all` 方法，结果在 `then` 和 `catch`  里都没执行。


## 反馈与建议
- 邮箱：<mindview@126.com>

---------
感谢阅读这份帮助文档，强烈欢迎大家`Star`和`Fork`，开启全新的图片裁切体验吧。




