const device = wx.getSystemInfoSync();       // 
const r2p = device.windowWidth / 750;        // rpx换算px, 1rpx等于多少像素
const p2r = 750 / device.windowWidth;        // px换算rpx, 1px等于多少rpx
const ratios = [1, 16 / 9, 4 / 3, 2 / 3, 0]; // 默认 裁切的宽高比
const boxMap = [                             // 默认 选取框的尺寸
  { w: 1 * 320, h: 1 * 320 },
  { w: 16 * 20, h: 9 *  20 },
  { w:  4 * 80, h: 3 *  80 },
  { w: 2 * 107, h: 3 * 107 },
  { w:     320, h:     320 }
];
// components/xcropper.js
Component({
  properties: {
    images: {
      type: [String, Array],
      value: "",
      observer: function (newVal, oldVal) {
        newVal && this.initImages(newVal);
      }
    },
    // 裁切配置
    cropperOpts: {
      type: Object,
      value: {
        boxX: undefined,       // 选取框的X轴坐标，相对屏幕左上角
        boxY: undefined,       // 选取框的Y轴坐标，相对屏幕左上角
        boxOffsetX: undefined, // 选取框在图片左上角的X轴偏移值
        boxOffsetY: undefined, // 选取框在图片左上角的Y轴偏移值
        boxW: 320,             // 选取框的宽
        boxH: 320,             // 选取框的高
        ratio: 1,              // 裁切的宽高比
        mode: "ratio",         // 裁切的模式: ratio-比例裁切,以原图尺寸等比裁切; size-尺寸裁切,以选取框尺寸倍数裁切
        shape: "rectangle",    // 裁切的形状: rectangle: 矩形; circle: 圆形
        sizes: undefined       // 裁切的尺寸: 生成的图片尺寸(宽)大小【为数字数组时存在Bug，Promise.all仅执行了第一个】
      }
    }
  },
  data: {
    debug: true,
    mode: "single",
    originals: [],
    retsults: [],
    inited: false,
    // 当前设备数据
    device: device,
    // 原始的图片数据
    originalImage: {
      width: 0,
      height: 0
    },
    // 裁切所需要的缩放数据
    cropper: {
      imageScale: 1, // “实际尺寸”缩放到合适“屏幕”的“缩放倍数”
      initialW: 0,   // 缩放之后的宽度
      initialH: 0,   // 缩放之后的高度
      scale: 1,      // 在缩放之后的的基础上再次缩放的缩放倍数,裁切时的预览效果的缩放倍数
      imgW: 0,       // 缩放之后的宽度,裁切时的预览宽度
      imgH: 0,       // 缩放之后的高度,裁切时的预览高度
      x: 0,          // 裁切起点的X坐标
      y: 0,          // 裁切起点的Y坐标
      realWidth: 0,  // 裁切选取的真实宽度
      realHeight: 0  // 裁切选取的真实高度
    },
    //
    touching: false,
    // 拖拽的边界坐标点
    boundary: {box: [], img: []},
    //
    moveStep: 0.1
  },
  methods: {
    // 设置裁切模式
    setMode(evt) {
      this.data.cropperOpts.mode = evt.currentTarget.dataset.ref;
      this.setData(this.data);
    },
    // 设置裁切比例
    setRatio(evt) {
      this.data.cropperOpts.ratio = evt.currentTarget.dataset.ref;
      this.initCropper();
    },
    // 设置裁切形状
    setShape(evt) {
      this.data.cropperOpts.shape = evt.currentTarget.dataset.ref;
      this.setData(this.data);
    },
    //
    initImages(imgs) {
      // 校验裁切必要的配置参数
      let cropperOpts = this.data.cropperOpts;
      // 有参数
      if (Object.keys(cropperOpts).length) {
        // 没设置比例且裁切框宽高设置不完整
        if (isNaN(cropperOpts.ratio) && (!cropperOpts.boxW || !cropperOpts.boxH)) {
          cropperOpts.ratio = 1;
          cropperOpts.boxW = 320;
          cropperOpts.boxH = 320;
        }
        if (cropperOpts.mode != "ratio" && cropperOpts.mode != "size") cropperOpts.mode = "ratio";
        if (cropperOpts.shape != "rectangle" && cropperOpts.shape != "circle") cropperOpts.shape = "rectangle";
      } else {
        console.error("缺少裁切的图片地址");
        this.triggerEvent("failure", {msg: "缺少必要参数"});
      }
      // 校验图片
      if (imgs) {
        if (Array.isArray(imgs)) {
          this.setData({
            originals: imgs,
            mode: imgs.length > 1 ? "multi" : "single"
          });
          this.loadImage();
        } else if (typeof imgs == "string") {
          this.setData({
            originals: [imgs],
            mode: "single"
          });;
          this.loadImage();
        } else {
          console.warn("裁切的图片数据类型错误");
          this.triggerEvent("failure", { msg: "缺少裁切的图片地址" });
        }
      } else {
        console.error("缺少裁切的图片地址");
        this.triggerEvent("failure", { msg: "缺少裁切的图片地址" });
      }
    },
    // 加载图片
    loadImage: function () {
      if (!this.data.originals.length) {
        console.log("全部处理完成");
        return false;
      }
      let self = this;
      this.data.imageSrc = this.data.originals.shift();
      wx.getImageInfo({
        src: this.data.imageSrc,
        success: function(res) {
          self.data.originalImage = res;
          self.data.originalImage.originalRatio = res.width / res.height;
          delete self.data.originalImage.errMsg;
          self.setData(self.data);
          //
          self.initCanvas();
        },
        fail: function(res) {
          self.reset();
          self.triggerEvent("failure", res);
        }
      });
    },
    // 初始化Canvas
    initCanvas() {
      this.originalCanvas = wx.createCanvasContext('original', this);
      let sizes = this.data.cropperOpts.sizes;
      if (sizes && (!isNaN(sizes) || Array.isArray(sizes))) {
        if (typeof sizes == "number") {
          sizes = [sizes];
        }
        console.log(sizes, sizes.length);
        if (Array.isArray(sizes)) {
          sizes.forEach((size, idx) => {
            this[`image${size}`] = wx.createCanvasContext(`image${size}`, this);
          });
        }
      }
      // 缩放图片
      this.initScale();
    },
    // 缩放图片适应屏幕
    initScale() {
      // 屏幕信息
      let winW = this.data.device.windowWidth, winH = this.data.device.windowHeight;
      let winRatio = winW / winH;
      // 图片信息
      let oImgW = this.data.originalImage.width, oImgH = this.data.originalImage.height;
      let oImgRatio = this.data.originalImage.originalRatio || oImgW / oImgH;
      // 图片适配屏幕
      let cropper = this.data.cropper;
      if (oImgRatio >= winRatio) {
        cropper.imageScale = oImgW / winW;
      } else {
        cropper.imageScale = oImgH / winH;
      }
      cropper.imgW = oImgW / cropper.imageScale;
      cropper.imgH = oImgH / cropper.imageScale;
      //
      cropper.x = (winW - cropper.imgW) / 2;
      cropper.y = (winH - cropper.imgH) / 2;
      // 保存原始缩放尺寸
      cropper.initialW = cropper.imgW;
      cropper.initialH = cropper.imgH;
      // 初始化裁切框
      this.initCropper();
    },
    // 缩放选取框适应图片
    initCropper: function() {
      let oImg = this.data.originalImage; this.data.originalImage.originalRatio
      let winW = this.data.device.windowWidth, winH = this.data.device.windowHeight;
      let cropper = this.data.cropper;
      // 选取框适配图片
      let cropperOpts = this.data.cropperOpts;
      if (!isNaN(cropperOpts.ratio)) {
        let ratioIdx = ratios.indexOf(cropperOpts.ratio);
        let boxWH = ratioIdx != -1 ? boxMap[ratioIdx] : null;
        if (boxWH && boxWH.w && boxWH.h) {
          let boxScale = 1;
          if (cropperOpts.ratio) {
            if (cropperOpts.ratio >= oImg.originalRatio) {
              boxScale = boxWH.w / cropper.imgW;
            } else {
              boxScale = boxWH.h / cropper.imgH;
            }
          } else {
            if (1 >= oImg.originalRatio) {
              boxScale = boxWH.w / cropper.imgW;
            } else {
              boxScale = boxWH.h / cropper.imgH;
            }
          }
          cropperOpts.boxW = boxWH.w / boxScale;
          cropperOpts.boxH = boxWH.h / boxScale;
        } else {
          console.warn("暂无该比例的尺寸设置");
        }
      } else if (cropperOpts.boxW && cropperOpts.boxH) {
        // 限制裁切选取框的宽高
        if (cropperOpts.boxW > cropper.imgW || cropperOpts.boxW < 50 || cropperOpts.boxH > cropper.imgH || cropperOpts.boxH < 50) {
          cropperOpts.boxW = cropper.imgW;
          cropperOpts.boxH = cropper.imgH;
          cropperOpts.ratio = cropperOpts.boxW / cropperOpts.boxH;
        } else {
          let newRatio = cropperOpts.boxW / cropperOpts.boxH;
          if (ratios.includes(newRatio)) {
            cropperOpts.ratio = newRatio;
          } else {
            cropperOpts.ratio = 0;
          }
        }
      } else {
        // cropperOpts.ratio = 1;
        // cropperOpts.boxW = cropperOpts.boxH = 320;
        console.warn(`Warn:${cropperOpts}`);
      }
      // 保存默认的裁切框尺寸，用于改变裁切框尺寸时作为运算参照
      cropperOpts.boxDefW = cropperOpts.boxW;
      cropperOpts.boxDefH = cropperOpts.boxH;
      // 保存最大的裁切框尺寸，用于改变裁切框尺寸时作为判断依据
      if (cropperOpts.ratio) {
        cropperOpts.boxMaxW = cropperOpts.boxW;
        cropperOpts.boxMaxH = cropperOpts.boxH;
      } else {
        cropperOpts.boxMaxW = cropper.imgW;
        cropperOpts.boxMaxH = cropper.imgH;
      }
      cropperOpts.boxMinW = 50;
      cropperOpts.boxMinH = 50;
      // 计算并保存裁切起点
      if (
        !isNaN(cropperOpts.boxX) && !isNaN(cropperOpts.boxY) &&
        cropperOpts.boxX > cropper.x && cropperOpts.boxX + cropperOpts.boxW <= cropper.x + cropper.imgW &&
        cropperOpts.boxY > cropper.y && cropperOpts.boxY + cropperOpts.boxH <= cropper.y + cropper.imgH
      ) {
        console.log(123)
      } else if (
        !isNaN(cropperOpts.boxOffsetX) && !isNaN(cropperOpts.boxOffsetY) &&
        cropperOpts.boxOffsetY >= 0 && cropperOpts.boxOffsetY >= 0 &&
        cropper.x + cropperOpts.boxOffsetX + cropperOpts.boxW <= cropper.x + cropper.imgW &&
        cropper.y + cropperOpts.boxOffsetY + cropperOpts.boxH <= cropper.y + cropper.imgH
      ) {
        cropperOpts.boxX = cropper.x + cropperOpts.boxOffsetX;
        cropperOpts.boxY = cropper.y + cropperOpts.boxOffsetY;
      }else {
        cropperOpts.boxX = Math.abs(winW - cropperOpts.boxW) / 2;
        cropperOpts.boxY = Math.abs(winH - cropperOpts.boxH) / 2;
      }
      cropperOpts.boxInitX = cropperOpts.boxX;
      cropperOpts.boxInitY = cropperOpts.boxY;
      // 计算边界
      this.initBoundary();
    },
    // 初始化边界坐标
    initBoundary() {
      let winW = this.data.device.windowWidth, winH = this.data.device.windowHeight;
      let cropperOpts = this.data.cropperOpts;
      let cropper = this.data.cropper;
      // 选取框四个点坐标
      this.data.boundary.box = [
        {
          x: (winW - cropperOpts.boxW) / 2,
          y: (winH - cropperOpts.boxH) / 2,
        }, {
          x: (winW - cropperOpts.boxW) / 2 + cropperOpts.boxW,
          y: (winH - cropperOpts.boxH) / 2,
        }, {
          x: (winW - cropperOpts.boxW) / 2,
          y: (winH - cropperOpts.boxH) / 2 + cropperOpts.boxH,
        }, {
          x: (winW - cropperOpts.boxW) / 2 + cropperOpts.boxW,
          y: (winH - cropperOpts.boxH) / 2 + cropperOpts.boxH,
        }
      ];
      // 图片四个点坐标
      this.data.boundary.img = [
        {
          x: this._numUtil((winW - cropper.imgW) / 2, Math.max(cropper.x, 0), "gt"), // 0
          y: this._numUtil((winH - cropper.imgH) / 2, Math.max(cropper.y, 0), "gt"), // 0
        }, {
          x: this._numUtil((winW - cropper.imgW) / 2 + cropper.imgW, Math.min(cropper.x + cropper.imgW, winW), "lt"),
          y: this._numUtil((winH - cropper.imgH) / 2, Math.max(cropper.y, 0), "gt"),
        }, {
          x: this._numUtil((winW - cropper.imgW) / 2, Math.max(cropper.x, 0), "gt"),
          y: this._numUtil((winH - cropper.imgH) / 2 + cropper.imgH, Math.min(cropper.y + cropper.imgH, winH), "lt"),
        }, {
          x: this._numUtil((winW - cropper.imgW) / 2 + cropper.imgW, Math.min(cropper.x + cropper.imgW, winW), "lt"),
          y: this._numUtil((winH - cropper.imgH) / 2 + cropper.imgH, Math.min(cropper.y + cropper.imgH, winH), "lt"),
        }
      ];
      //
      this.data.inited = true;
      this.setData(this.data);
    },
    // 数字比较辅助方法
    _numUtil(num, def, mode) {
      if (mode == "gt") {
        return num >= def ? num : def;
      } else if (mode == "lt") {
        return num <= def ? num : def;
      } else {
        return num;
      }
    },
    // 重置数据
    reset: function() {
      this.setData({
        imageSrc: null,
        images: null,
        originals: null,
        cropper: {
          imageScale: 1, // 实际尺寸缩放到合适选取框的缩放倍数
          initialW: 0,   // 缩放之后的宽度
          initialH: 0,   // 缩放之后的高度
          scale: 1,      // 在缩放之后的的基础上再次缩放的缩放倍数,裁切时的预览效果的缩放倍数
          imgW: 0,       // 缩放之后的宽度,裁切时的预览宽度
          imgH: 0,       // 缩放之后的高度,裁切时的预览高度
          x: 0,          // 裁切起点的X坐标
          y: 0,          // 裁切起点的Y坐标
          realWidth: 0,  // 裁切选取的真实宽度
          realHeight: 0  // 裁切选取的真实高度
        }
      });
    },
    // 背景 touch 事件处理
    touchstart: function(evt) {
      // 过滤其他来源的事件
      let isPassEvt = evt.target.dataset.evt == "y";
      if (isPassEvt) return false;
      // 过滤非法操作
      if (!this.data.imageSrc) return false;
      //
      this.data.touching = true;
      this.data.cropper.oldX = evt.touches[0].clientX;
      this.data.cropper.oldY = evt.touches[0].clientY;
      //
      if (evt.touches.length >= 2) {
        let xMove = evt.touches[1].clientX - evt.touches[0].clientX;
        let yMove = evt.touches[1].clientY - evt.touches[0].clientY;
        this.data.cropper.oldDistance = Math.sqrt(xMove * xMove + yMove * yMove);
      }
    },
    // 背景 touch 事件处理
    touchmove: function(evt) {
      // 过滤其他来源的事件
      let isPassEvt = evt.target.dataset.evt == "y";
      if (isPassEvt) return false;
      // 过滤非法操作
      if (!this.data.imageSrc || !this.data.touching) return false;
      //
      let cropper = this.data.cropper, cropperOpts = this.data.cropperOpts, boundary = this.data.boundary;
      if (evt.touches.length >= 2) {
        let xMove = evt.touches[1].clientX - evt.touches[0].clientX;
        let yMove = evt.touches[1].clientY - evt.touches[0].clientY;
        let distance = Math.sqrt(xMove * xMove + yMove * yMove);
        let distanceDiff = (distance - cropper.oldDistance);
        //如果滑动距离大于0再进行缩放
        if (Math.abs(distanceDiff) >= 0) {
          cropper.scale = cropper.scale + 0.0004 * distanceDiff
          if (cropper.scale > 2) cropper.scale = 2;
          if (cropper.scale < 1) cropper.scale = 1;
          this.scale();
        }
      } else {
        let xMove = (evt.touches[0].clientX - cropper.oldX) * 0.09;
        let yMove = (evt.touches[0].clientY - cropper.oldY) * 0.09;
        // X
        if (Math.abs(xMove) >= 1 && Math.abs(yMove) < 1) {
          cropper.x = cropper.x + Math.round(xMove)
          // 禁止超出边框
          if (cropper.x >= boundary.box[0].x) {
            cropper.x = boundary.box[0].x;
          }
          if (cropper.x <= -(cropper.imgW - boundary.box[1].x)) {
            cropper.x = -(cropper.imgW - boundary.box[1].x);
          }
          // 重新计算裁切框位置坐标
          if (cropper.x > cropperOpts.boxX) {
            cropperOpts.boxX = cropper.x;
          } else if (cropper.x + cropper.imgW < cropperOpts.boxX + cropperOpts.boxW) {
            cropperOpts.boxX = cropper.x + cropper.imgW - cropperOpts.boxW;
          }
          if (cropper.y > cropperOpts.boxY) {
            cropperOpts.boxY = cropper.y;
          } else if (cropper.y + cropper.imgH < cropperOpts.boxY + cropperOpts.boxH) {
            cropperOpts.boxY = cropper.y + cropper.imgH - cropperOpts.boxH;
          }
          cropperOpts.boxInitX = cropperOpts.boxX;
          cropperOpts.boxInitY = cropperOpts.boxY;
          // 重新计算边界
          this.initBoundary();
          // this.setData(this.data);
        }
        // Y
        if (Math.abs(xMove) < 1 && Math.abs(yMove) >= 1) {
          cropper.y = cropper.y + Math.round(yMove);
          // 禁止超出边框
          if (cropper.y >= boundary.box[0].y) {
            cropper.y = boundary.box[0].y;
          }
          if (cropper.y <= -(cropper.imgH - boundary.box[2].y)) {
            cropper.y = -(cropper.imgH - boundary.box[2].y);
          }
          // 重新计算裁切框位置坐标
          if (cropper.x > cropperOpts.boxX) {
            cropperOpts.boxX = cropper.x;
          } else if (cropper.x + cropper.imgW < cropperOpts.boxX + cropperOpts.boxW) {
            cropperOpts.boxX = cropper.x + cropper.imgW - cropperOpts.boxW;
          }
          if (cropper.y > cropperOpts.boxY) {
            cropperOpts.boxY = cropper.y;
          } else if (cropper.y + cropper.imgH < cropperOpts.boxY + cropperOpts.boxH) {
            cropperOpts.boxY = cropper.y + cropper.imgH - cropperOpts.boxH;
          }
          cropperOpts.boxInitX = cropperOpts.boxX;
          cropperOpts.boxInitY = cropperOpts.boxY;
          // 重新计算边界
          this.initBoundary();
          // this.setData(this.data);
        }
        // X && Y
        if (Math.abs(xMove) >= 1 && Math.abs(yMove) >= 1) {
          cropper.x = cropper.x + Math.round(xMove);
          cropper.y = cropper.y + Math.round(yMove);
          //禁止超出边框
          if (cropper.x >= boundary.box[0].x) {
            cropper.x = boundary.box[0].x;
          }
          if (cropper.x <= -(cropper.imgW - boundary.box[1].x)) {
            cropper.x = -(cropper.imgW - boundary.box[1].x);
          }
          if (cropper.y >= boundary.box[0].y) {
            cropper.y = boundary.box[0].y;
          }
          if (cropper.y <= -(cropper.imgH - boundary.box[2].y)) {
            cropper.y = -(cropper.imgH - boundary.box[2].y);
          }
          // 重新计算裁切框位置坐标
          if (cropper.x > cropperOpts.boxX) {
            cropperOpts.boxX = cropper.x;
          } else if (cropper.x + cropper.imgW < cropperOpts.boxX + cropperOpts.boxW) {
            cropperOpts.boxX = cropper.x + cropper.imgW - cropperOpts.boxW;
          }
          if (cropper.y > cropperOpts.boxY) {
            cropperOpts.boxY = cropper.y;
          } else if (cropper.y + cropper.imgH < cropperOpts.boxY + cropperOpts.boxH) {
            cropperOpts.boxY = cropper.y + cropper.imgH - cropperOpts.boxH;
          }
          cropperOpts.boxInitX = cropperOpts.boxX;
          cropperOpts.boxInitY = cropperOpts.boxY;
          // 重新计算边界
          this.initBoundary();
          // this.setData(this.data);
        }
      }
    },
    // 背景 touch 事件处理
    touchend: function(evt) {
      if (!this.data.imageSrc || !this.data.touching) return false;
      this.data.touching = false;
      this.data.cropperOpts.boxX = Math.abs(this.data.device.windowWidth - this.data.cropperOpts.boxW) / 2;
      this.data.cropperOpts.boxY = Math.abs(this.data.device.windowHeight - this.data.cropperOpts.boxH) / 2;
      this.data.cropper.oldX = 0;
      this.data.cropper.oldY = 0;
    },
    // 裁切框拖拽点 touch 事件处理
    dragStart(evt) {
      // console.log("dragStart");
      this.boxEvtX = evt.touches[0].clientX;
      this.boxEvtY = evt.touches[0].clientY;
    },
    // 裁切框拖拽点 touch 事件处理
    dragMove(evt) {
      // console.log("dragMove");
      let winW = this.data.device.windowWidth, winH = this.data.device.windowHeight;
      let cropper = this.data.cropper;
      let cropperOpts = this.data.cropperOpts;
      var direction = evt.target.dataset.drag;
      let xSize = this.boxEvtX - evt.touches[0].clientX;
      let ySize = this.boxEvtY - evt.touches[0].clientY;
      let absX = Math.abs(xSize), absY = Math.abs(ySize);
      // 处理不同的方向的拖动
      switch (direction) {
        case "l":
          if (xSize >= 0) {
            xSize = absX;
            // this.data.debug && console.log("Left: 放大");
          } else {
            xSize = -absX;
            // this.data.debug && console.log("Left: 缩小");
          }
          ySize = 0;
          break;
        case "r":
          if (xSize >= 0) {
            xSize = -absX;
            // this.data.debug && console.log("Right: 缩小");
          } else {
            xSize = absX;
            // this.data.debug && console.log("Right: 放大");
          }
          ySize = 0;
          break;
        case "t":
          if (ySize >= 0) {
            ySize = absY;
            // this.data.debug && console.log("Top: 放大");
          } else {
            ySize = -absY;
            // this.data.debug && console.log("Top: 缩小");
          }
          xSize = 0;
          break;
        case "tl":
          if (absX >= absY) {
            if (xSize >= 0) {
              xSize = absX;
              //this.data.debug && console.log(`TopLeft: X@放大(${xSize},${ySize})`);
            } else {
              xSize = -absX;
              //this.data.debug && console.log(`TopLeft: X@缩小(${xSize},${ySize})`);
            }
            ySize = 0;
          } else {
            if (ySize >= 0) {
              ySize = absY;
              //this.data.debug && console.log(`TopLeft: Y@放大(${xSize},${ySize})`);
            } else {
              ySize = -absY;
              //this.data.debug && console.log(`TopLeft: Y@缩小(${xSize},${ySize})`);
            }
            xSize = 0;
          }
          break;
        case "tr":
          if (absX >= absY) {
            if (xSize >= 0) {
              xSize = -absX;
              //this.data.debug && console.log(`TopRight: X@缩小(${xSize},${ySize})`);
            } else {
              xSize = absX;
              //this.data.debug && console.log(`TopRight: X@放大(${xSize},${ySize})`);
            }
            ySize = 0;
          } else {
            if (ySize >= 0) {
              ySize = absY;
              //this.data.debug && console.log(`TopRight: Y@放大(${xSize},${ySize})`);
            } else {
              ySize = -absY;
              //this.data.debug && console.log(`TopRight: Y@缩小(${xSize},${ySize})`);
            }
            xSize = 0;
          }
          break;
        case "b":
          if (ySize >= 0) {
            ySize = -absY;
            // this.data.debug && console.log("Bottom: 缩小");
          } else {
            ySize = absY;
            // this.data.debug && console.log("Bottom: 放大");
          }
          xSize = 0;
          break;
        case "bl":
          if (absX >= absY) {
            if (xSize >= 0) {
              xSize = absX;
              // this.data.debug && console.log(`BottomLeft: X@放大(${xSize},${ySize})`);
            } else {
              xSize = -absX;
              // this.data.debug && console.log(`BottomLeft: X@缩小(${xSize},${ySize})`);
            }
            ySize = 0;
          } else {
            if (ySize >= 0) {
              ySize = -absY;
              // this.data.debug && console.log(`BottomLeft: Y@缩小(${xSize},${ySize})`);
            } else {
              ySize = absY;
              // this.data.debug && console.log(`BottomLeft: Y@放大(${xSize},${ySize})`);
            }
            xSize = 0;
          }
          break;
        case "br":
          if (absX >= absY) {
            if (xSize >= 0) {
              xSize = -absX;
              // this.data.debug && console.log(`BottomRight: X@缩小(${xSize},${ySize})`);
            } else {
              xSize = absX;
              // this.data.debug && console.log(`BottomRight: X@放大(${xSize},${ySize})`);
            }
            ySize = 0;
          } else {
            if (ySize >= 0) {
              ySize = -absY;
              // this.data.debug && console.log(`BottomRight: Y@缩小(${xSize},${ySize})`);
            } else {
              ySize = absY;
              // this.data.debug && console.log(`BottomRight: Y@放大(${xSize},${ySize})`);
            }
            xSize = 0;
          }
          break;
        default:
          console.warn("Unknown Direction");
          break;
      }
      // 缩放的处理
      if (xSize !== 0) {
        let newBoxW = cropperOpts.boxDefW + xSize;
        let newBoxH = newBoxW / cropperOpts.ratio;
        //
        if (direction == "l" || direction == "tl" || direction == "bl") {
          if (xSize > 0) {
            cropperOpts.boxX = cropperOpts.boxInitX + xSize;
          } else {
            cropperOpts.boxX = cropperOpts.boxInitX - xSize;
          }
        }
        if (newBoxW <= cropperOpts.boxMaxW && newBoxW >= cropperOpts.boxMinW && cropperOpts.boxY + newBoxH <= cropper.y + cropper.imgH) {
          cropperOpts.boxW = newBoxW;
          if (cropperOpts.ratio) {
            cropperOpts.boxH = newBoxH;
            // this.data.debug && console.log(cropperOpts);
          } else {
            // this.data.debug && console.log("【自定义】高度不做改变", cropperOpts.boxDefW, xSize, cropperOpts.boxMaxW);
          }
        } else {
          // this.data.debug && console.log("宽度高度已达到临界值");
        }
        // 更新裁切框位置(居中)
        // cropperOpts.boxX = Math.abs(winW - cropperOpts.boxW) / 2;
        // cropperOpts.boxY = Math.abs(winH - cropperOpts.boxH) / 2;
        this.setData(this.data);
      } else if (ySize !== 0) {
        let newBoxH = cropperOpts.boxDefH + ySize;
        let newBoxW = newBoxH * cropperOpts.ratio;
        //
        if (direction == "t" || direction == "tl" || direction == "tr") {
          if (ySize > 0) {
            cropperOpts.boxY = cropperOpts.boxInitY + ySize;
          } else {
            cropperOpts.boxY = cropperOpts.boxInitY - ySize;
          }
        }
        if (newBoxH <= cropperOpts.boxMaxH && newBoxH >= cropperOpts.boxMinH && cropperOpts.boxX + newBoxW <= cropper.x + cropper.imgW) {
          cropperOpts.boxH = newBoxH;
          if (cropperOpts.ratio) {
            cropperOpts.boxW = newBoxH * cropperOpts.ratio;
            // this.data.debug && console.log(cropperOpts);
          } else {
            // this.data.debug && console.log("【自定义】宽度不做改变", cropperOpts.boxH, ySize, cropperOpts.boxMaxH);
          }
        } else {
          // this.data.debug && console.log("高度已达到临界值");
        }
        // 更新裁切框位置(居中)
        // cropperOpts.boxX = Math.abs(winW - cropperOpts.boxW) / 2;
        // cropperOpts.boxY = Math.abs(winH - cropperOpts.boxH) / 2;
        this.setData(this.data);
      } else {
        // this.data.debug && console.log("无变化");
      }
    },
    // 裁切框拖拽点 touch 事件处理
    dragStop(evt) {
      // console.log("dragStop");
      let cropperOpts = this.data.cropperOpts;
      cropperOpts.boxInitX = cropperOpts.boxX;
      cropperOpts.boxInitY = cropperOpts.boxY;
      cropperOpts.boxDefW = cropperOpts.boxW;
      cropperOpts.boxDefH = cropperOpts.boxH;
      delete this.boxEvtX;
      delete this.boxEvtY;
      this.setData(this.data);
    },
    // 裁切框 touch 事件处理
    boxStartMove(evt) {
      this.boxMoving = true;
      if (evt.touches.length == 2) {
        let xMove = evt.touches[1].clientX - evt.touches[0].clientX;
        let yMove = evt.touches[1].clientY - evt.touches[0].clientY;
        this.data.cropper.oldDistance = Math.sqrt(xMove * xMove + yMove * yMove);
      } else {
        this.boxMoveX = evt.touches[0].clientX;
        this.boxMoveY = evt.touches[0].clientY;
      }
    },
    // 裁切框 touch 事件处理
    boxMoveing(evt) {
      if (!this.boxMoving) return false;
      let cropperOpts = this.data.cropperOpts, cropper = this.data.cropper, boundary = this.data.boundary;
      if (evt.touches.length == 2) {
        // scale
        let xMove = evt.touches[1].clientX - evt.touches[0].clientX;
        let yMove = evt.touches[1].clientY - evt.touches[0].clientY;
        let distance = Math.sqrt(xMove * xMove + yMove * yMove);
        let distanceDiff = (distance - cropper.oldDistance);
        console.log(distanceDiff);
        //如果滑动距离大于0再进行缩放
        if (Math.abs(distanceDiff) >= 0) {
          cropper.scale = cropper.scale + 0.0004 * distanceDiff
          if (cropper.scale > 2) cropper.scale = 2;
          if (cropper.scale < 1) cropper.scale = 1;
          this.scale();
        }
      } else {
        // move box
        let xSize = (this.boxMoveX - evt.touches[0].clientX) * 1;
        let ySize = (this.boxMoveY - evt.touches[0].clientY) * 1;
        let absX = Math.abs(xSize), absY = Math.abs(ySize);
        // X
        if (absX >= 1 && absY < 1) {
          cropperOpts.boxX = cropperOpts.boxInitX - xSize;
          //禁止超出边框
          if (cropperOpts.boxX <= boundary.img[0].x) {
            cropperOpts.boxX = boundary.img[0].x;
          }
          if (cropperOpts.boxX >= boundary.img[1].x - cropperOpts.boxW) {
            cropperOpts.boxX = boundary.img[1].x - cropperOpts.boxW;
          }
          this.setData(this.data);
        }
        // Y
        if (absX < 1 && absY >= 1) {
          cropperOpts.boxY = cropperOpts.boxInitY - ySize;
          //禁止超出边框
          if (cropperOpts.boxY <= boundary.img[0].y) {
            cropperOpts.boxY = boundary.img[0].y;
          }
          if (cropperOpts.boxY >= boundary.img[2].y - cropperOpts.boxH) {
            cropperOpts.boxY = boundary.img[2].y - cropperOpts.boxH;
          }
          this.setData(this.data);
        }
        // X && Y
        if (absX >= 1 && absY >= 1) {
          cropperOpts.boxX = cropperOpts.boxInitX - xSize;
          cropperOpts.boxY = cropperOpts.boxInitY - ySize;
          //禁止超出边框
          if (cropperOpts.boxX <= boundary.img[0].x) {
            cropperOpts.boxX = boundary.img[0].x;
          }
          if (cropperOpts.boxX >= boundary.img[1].x - cropperOpts.boxW) {
            cropperOpts.boxX = boundary.img[1].x - cropperOpts.boxW;
          }
          if (cropperOpts.boxY <= boundary.img[0].y) {
            cropperOpts.boxY = boundary.img[0].y;
          }
          if (cropperOpts.boxY >= boundary.img[2].y - cropperOpts.boxH) {
            cropperOpts.boxY = boundary.img[2].y - cropperOpts.boxH;
          }
          this.setData(this.data);
        }
      }
    },
    // 裁切框 touch 事件处理
    boxStopMove(evt) {
      this.boxMoving = false;
      delete this.boxMoveX;
      delete this.boxMoveY;
      let cropperOpts = this.data.cropperOpts;
      cropperOpts.boxInitX = cropperOpts.boxX;
      cropperOpts.boxInitY = cropperOpts.boxY;
      this.setData(this.data);
    },
    // 缩放图片
    scale: function() {
      let device = this.data.device, cropper = this.data.cropper, cropperOpts = this.data.cropperOpts;
      cropper.imgW = cropper.scale * cropper.initialW;
      cropper.imgH = cropper.scale * cropper.initialH;
      cropper.x = (device.windowWidth - cropper.imgW) / 2;
      cropper.y = (device.windowHeight - cropper.imgH) / 2;
      // 重新计算裁切框位置坐标
      if (cropper.x > cropperOpts.boxX) {
        cropperOpts.boxX = cropper.x;
      } else if (cropper.x + cropper.imgW < cropperOpts.boxX + cropperOpts.boxW) {
        cropperOpts.boxX = cropper.x + cropper.imgW - cropperOpts.boxW;
      }
      if (cropper.y > cropperOpts.boxY) {
        cropperOpts.boxY = cropper.y;
      } else if (cropper.y + cropper.imgH < cropperOpts.boxY + cropperOpts.boxH) {
        cropperOpts.boxY = cropper.y + cropper.imgH - cropperOpts.boxH;
      }
      cropperOpts.boxInitX = cropperOpts.boxX;
      cropperOpts.boxInitY = cropperOpts.boxY;
      // 重新计算边界
      this.initBoundary();
      // this.setData(this.data);
    },
    // 裁切
    imageCut(size) {
      let self = this;
      //
      return new Promise(function (resolve, reject) {
        wx.showToast({
          title: '正在生成...',
          duration: 10000
        });
        // 原图画布绘制
        let cropperOpts = self.data.cropperOpts, cropper = self.data.cropper, oImg = self.data.originalImage;
        let imageScale = cropper.imageScale, scale = cropper.scale;
        let realScale = oImg.width / cropper.imgW;
        //
        if (size) {
          let sizeCanvas = self[`image${size}`];
          if (!sizeCanvas) {
            console.warn(`找不到指定尺寸(${size})的Canvas`);
            reject(`找不到指定尺寸(${size})的Canvas`);
            return false;
          }
          sizeCanvas.drawImage(self.data.imageSrc,
            // 从图片的 (x,y) 位置选取 (w,h) 尺寸的图像
            (cropperOpts.boxX - cropper.x) * realScale,
            (cropperOpts.boxY - cropper.y) * realScale,
            cropperOpts.boxW * realScale,
            cropperOpts.boxH * realScale,
            // 绘制在画布的 (x,y) 位置，尺寸为 (w,h)
            0, 0, size, size / cropperOpts.ratio
          );
          sizeCanvas.draw();
          // 不加延时有时截取出来的是空白图片
          setTimeout(function () {
            wx.canvasToTempFilePath({
              x: 0,
              y: 0,
              width: size,
              height: size / cropperOpts.ratio,
              destWidth: size,
              destHeight: size / cropperOpts.ratio,
              canvasId: `image${size}`,
              fileType: 'jpg',
              quality: 1,
              success: function (res) {
                console.log(res);
                resolve({ size: size || "", path: res.tempFilePath });
              },
              fail(err) {
                console.warn(err);
                reject(err);
              }
            }, self);
          }, 500);
        } else {
          self.originalCanvas.drawImage(self.data.imageSrc, 0, 0, oImg.width, oImg.height);
          // self.originalCanvas.drawImage(
          //   self.data.imageSrc, 0, 0,
          //   cropper.imgW * realScale,
          //   cropper.imgH * realScale
          // );
          self.originalCanvas.draw();
          //
          let newImgW = cropperOpts.boxW * realScale;
          let newImgH = cropperOpts.boxH * realScale;
          // 不同的裁切模式生成的图像大小处理
          // TODO:: 裁切选取框的尺寸有点小，是否需要扩大一定倍数？？
          if (cropperOpts.mode == "size") {
            newImgW = cropperOpts.boxW;
            newImgH = cropperOpts.boxH;
          }
          // 不加延时有时截取出来的是空白图片
          setTimeout(function() {
            wx.canvasToTempFilePath({
              x: (cropperOpts.boxX - cropper.x) * realScale,
              y: (cropperOpts.boxY - cropper.y) * realScale,
              width: cropperOpts.boxW * realScale,
              height: cropperOpts.boxH * realScale,
              destWidth: newImgW,
              destHeight: newImgH,
              canvasId: 'original',
              fileType: 'jpg',
              quality: 1,
              success: function (res) {
                resolve({size: size || "", path: res.tempFilePath});
              },
              fail(err) {
                console.warn(err);
                reject(err);
              }
            }, self);
          }, 50);
        }
      });
    },
    // 确定
    ensure() {
      let self = this, mode = this.data.mode;
      if (this.data.cropperOpts.sizes) {
        if (Array.isArray(this.data.cropperOpts.sizes)) {
          let imgsCutPromise = [];
          this.data.cropperOpts.sizes.forEach((size, index) => {
            imgsCutPromise.push(this.imageCut(size));
          });
          console.log(imgsCutPromise);
          Promise.all(imgsCutPromise).then(res => {
            console.log(res);
            wx.hideToast();
            if (mode == "multi") {
              self.data.retsults.push(res);
              if (self.data.originals.length) {
                self.loadImage();
              } else {
                self.triggerEvent('success', self.data.retsults);
              }
            } else {
              self.triggerEvent('success', res);
            }
          }).catch(res => {
            console.error(res);
            wx.hideToast();
            wx.showModal({
              title: '保存失败',
              content: '临时图片保存失败',
              showCancel: false
            });
            self.triggerEvent('failure');
          });
        } else if (!isNaN(this.data.cropperOpts.sizes)){
          this.imageCut(this.data.cropperOpts.sizes).then(res => {
            wx.hideToast();
            if (mode == "multi") {
              self.data.retsults.push(res);
              if (self.data.originals.length) {
                self.loadImage();
              } else {
                self.triggerEvent('success', self.data.retsults);
              }
            } else {
              self.triggerEvent('success', res);
            }
          }).catch(res => {
            wx.hideToast();
            wx.showModal({
              title: '保存失败',
              content: '临时图片保存失败',
              showCancel: false
            });
            console.error(res);
            self.triggerEvent('failure');
          });
        } else {
          console.log("裁切???");
        }
      } else {
        this.imageCut().then(res => {
          wx.hideToast();
          if (mode == "multi") {
            self.data.retsults.push(res);
            if (self.data.originals.length) {
              self.loadImage();
            } else {
              self.triggerEvent('success', self.data.retsults);
            }
          } else {
            self.triggerEvent('success', res);
          }
        }).catch(res => {
          wx.hideToast();
          wx.showModal({
            title: '保存失败',
            content: '临时图片保存失败',
            showCancel: false
          });
          console.error(res);
          self.triggerEvent('failure');
        });
      }
    },
    // 重新选择图片
    rechoose(evt) {
      let self = this;
      wx.chooseImage({
        count: 1,
        sizeType: ["original", "compressed"],
        sourceType: ["album", "camera"],
        success: function (res) {
          self.setData({
            images: res.tempFilePaths[0]
          });
        },
        fail: function (res) {
          console.warn(res);
        }
      });
    },
    // 裁切取消
    cancel(evt) {
      this.reset();
      this.triggerEvent('failure');
    }
  },
  created: function () {},
  attached: function () {},
  ready: function () { },
  moved: function (evt) { },
  detached: function (evt) { }
});
