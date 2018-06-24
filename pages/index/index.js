//index.js
//获取应用实例
const app = getApp()

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
