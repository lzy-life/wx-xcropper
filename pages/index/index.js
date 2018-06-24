//index.js
//获取应用实例
const app = getApp()

Page({
  data: {
    images: null,
    enableCropper: false,
    cutImages: null,
    cropperOpts: {
      ratio: 16/9
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
    this.setData({
      enableCropper: false,
      cutImages: null,
      images: Aarray.isArray(evt.detail) ? evt.detail : evt.detail.path
    });
  },
  failure: function (evt) {
    this.setData({
      cutImages: null,
      enableCropper: false
    });
  },
})
