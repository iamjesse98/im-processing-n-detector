// removes an element from an array according to index
Array.prototype.remove = function (index) {
    var rest = this.slice(index + 1);
    this.length = index;
    return this.push.apply(this, rest);
};

class Nude {
    constructor() {
        this.initCanavas();
        this.skinRegions = [];
        this.resultFn = null;
        this.isSafe = null;
    }
    initCanavas() {
        this.canvas = document.createElement("canvas");
        // the canvas should not be visible
        // this.canvas.style.display = "none";
        var b = document.getElementsByTagName("body")[0];
        b.appendChild(this.canvas);
        this.ctx = this.canvas.getContext("2d");
    }

    // this can be called - public
    load(selector) {
        // get the image
        this.img = document.querySelector(selector);
        // apply the width and height to the canvas element
        this.canvas.width = this.img.width;
        this.canvas.height = this.img.height;
        // reset the result function
        this.resultFn = null;
        // draw the image into the canvas element
        this.ctx.drawImage(this.img, 0, 0);
    }

    // this can be called - public
    scan(fn) {
        if(arguments.length > 0 && typeof (arguments[0]) == "function") {
            this.resultFn = fn;
        }
        this.scanImage();
    }

    scanImage() {
        // get the image data
        var image = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        var imageData = image.data;
        var skinMap = [];
        var detectedRegions = [];
        var mergeRegions = [];
        var width = this.canvas.width;
        var lastFrom = -1;
        var lastTo = -1;

        var addMerge = (from, to) => {
            lastFrom = from;
            lastTo = to;
            var len = mergeRegions.length,
                fromIndex = -1,
                toIndex = -1;
            while (len--) {
                var region = mergeRegions[len],
                    rlen = region.length;
                while (rlen--) {
                    if (region[rlen] == from) {
                        fromIndex = len;
                    }
                    if (region[rlen] == to) {
                        toIndex = len;
                    }
                }
            }
            if (fromIndex != -1 && toIndex != -1 && fromIndex == toIndex) {
                return;
            }
            if (fromIndex == -1 && toIndex == -1) {
                mergeRegions.push([from, to]);
                return;
            }
            if (fromIndex != -1 && toIndex == -1) {
                mergeRegions[fromIndex].push(to);
                return;
            }
            if (fromIndex == -1 && toIndex != -1) {
                mergeRegions[toIndex].push(from);
                return;
            }
            if (fromIndex != -1 && toIndex != -1 && fromIndex != toIndex) {
                mergeRegions[fromIndex] = mergeRegions[fromIndex].concat(mergeRegions[toIndex]);
                mergeRegions.remove(toIndex);
                return;
            }
        };

        // iterate the image from the top left to the bottom right
        var length = imageData.length;
        width = this.canvas.width;
        for (var i = 0, u = 1; i < length; i += 4, u++) {
            var r = imageData[i],
                g = imageData[i + 1],
                b = imageData[i + 2],
                x = (u > width) ? ((u % width) - 1) : u,
                y = (u > width) ? (Math.ceil(u / width) - 1) : 1;

            if (this.classifySkin(r, g, b)) { // 
                skinMap.push({ "id": u, "skin": true, "region": 0, "x": x, "y": y, "checked": false });
                var region = -1,
                    checkIndexes = [u - 2, (u - width) - 2, u - width - 1, (u - width)],
                    checker = false;
                for (var o = 0; o < 4; o++) {
                    var index = checkIndexes[o];
                    if (skinMap[index] && skinMap[index].skin) {
                        if (skinMap[index].region != region && region != -1 && lastFrom != region && lastTo != skinMap[index].region) {
                            addMerge(region, skinMap[index].region);
                        }
                        region = skinMap[index].region;
                        checker = true;
                    }
                }
                if (!checker) {
                    skinMap[u - 1].region = detectedRegions.length;
                    detectedRegions.push([skinMap[u - 1]]);
                    continue;
                } else {
                    if (region > -1) {
                        if (!detectedRegions[region]) {
                            detectedRegions[region] = [];
                        }
                        skinMap[u - 1].region = region;
                        detectedRegions[region].push(skinMap[u - 1]);
                    }
                }
            } else {
                skinMap.push({ "id": u, "skin": false, "region": 0, "x": x, "y": y, "checked": false });
            }
        }
        this.merge(detectedRegions, mergeRegions);
        this.analyseRegions();
    }
    // function for merging detected regions
    merge(detectedRegions, mergeRegions) {
        var length = mergeRegions.length;
        this.detRegions = [];
        // merging detected regions 
        while (length--) {
            var region = mergeRegions[length],
                rlen = region.length;
            if (!this.detRegions[length])
                this.detRegions[length] = [];
            while (rlen--) {
                var index = region[rlen];
                this.detRegions[length] = this.detRegions[length].concat(detectedRegions[index]);
                detectedRegions[index] = [];
            }
        }
        // push the rest of the regions to the this.detRegions array
        // (regions without merging)
        var l = detectedRegions.length;
        while (l--) {
            if (detectedRegions[l].length > 0) {
                this.detRegions.push(detectedRegions[l]);
            }
        }
        // clean up
        this.clearRegions(this.detRegions);
    }
    // clean up function
    // only pushes regions which are bigger than a specific amount to the final result
    clearRegions(detectedRegions) {
        var length = detectedRegions.length;
        for (var i = 0; i < length; i++) {
            if (detectedRegions[i].length > 30) {
                this.skinRegions.push(detectedRegions[i]);
            }
        }

    }
    analyseRegions() {
        // sort the detected regions by size
        var length = this.skinRegions.length,
            totalPixels = this.canvas.width * this.canvas.height,
            totalSkin = 0;
        // if there are less than 3 regions
        if (length < 3) {
            this.resultHandler(false);
            this.isSafe = true;
            return;
        }
        // check
        this.skinRegions = this.skinRegions.sort( (a ,b) => b.length - a.length )
        // count total skin pixels
        while (length--) {
            totalSkin += this.skinRegions[length].length;
        }

        // check if there are more than 15% skin pixel in the image
        if ((totalSkin / totalPixels) * 100 < 15) {
            // if the percentage lower than 15, it's not nude!
            //console.log("it's not nude :) - total skin percent is "+((totalSkin/totalPixels)*100)+"% ");
            this.resultHandler(false);
            this.isSafe = true;
            return;
        }
        // check if the largest skin region is less than 35% of the total skin count
        // AND if the second largest region is less than 30% of the total skin count
        // AND if the third largest region is less than 30% of the total skin count
        if ((this.skinRegions[0].length / totalSkin) * 100 < 35
            && (this.skinRegions[1].length / totalSkin) * 100 < 30
            && (this.skinRegions[2].length / totalSkin) * 100 < 30) {
            // the image is not nude.
            //console.log("it's not nude :) - less than 35%,30%,30% skin in the biggest areas :" + ((skinRegions[0].length/totalSkin)*100) + "%, " + ((skinRegions[1].length/totalSkin)*100)+"%, "+((skinRegions[2].length/totalSkin)*100)+"%");
            this.resultHandler(false);
            this.isSafe = true;
            return;
        }

        // check if the number of skin pixels in the largest region is less than 45% of the total skin count
        if ((this.skinRegions[0].length / totalSkin) * 100 < 45) {
            // it's not nude
            //console.log("it's not nude :) - the biggest region contains less than 45%: "+((skinRegions[0].length/totalSkin)*100)+"%");
            this.resultHandler(false);
            this.isSafe = true;
            return;
        }
        // TODO at bottom
        if (this.skinRegions.length > 60) {
            //console.log("it's not nude :) - more than 60 skin regions");
            this.resultHandler(false);
            this.isSafe = true;
            return;
        }
        // otherwise it is nude
        this.resultHandler(true);
        this.isSafe = false;
    }
    // the result handler will be executed when the analysing process is done
    // the result contains true (it is nude) or false (it is not nude)
    // if the user passed an result function to the scan function, the result function will be executed
    // otherwise the default resulthandling executes
    resultHandler(result) {
        if (this.resultFn) {
            this.resultFn(result);
        } else {
            result ? console.log("the picture contains nudity") : console.log('Its is safe');
        }
    }
    // colorizeRegions function is for testdevelopment only
    // the detected skinRegions will be painted in random colors (one color per region)
    colorizeRegions() {
        var length = this.skinRegions.length;
        for (var i = 0; i < length; i++) {
            var region = skinRegions[i],
                regionLength = region.length,
                randR = Math.ceil(Math.random() * 255),
                randG = Math.ceil(Math.random() * 255),
                rangB = Math.ceil(Math.random() * 255);
            for (var o = 0; o < regionLength; o++) {
                var pixel = this.ctx.getImageData(region[o].x, region[o].y, 1, 1),
                    pdata = pixel.data;
                pdata[0] = randR;
                pdata[1] = randG;
                pdata[2] = rangB;
                pixel.data = pdata;
                this.ctx.putImageData(pixel, region[o].x, region[o].y);
            }
        }
    }

    classifySkin(r, g, b) {
        // A Survey on Pixel-Based Skin Color Detection Techniques
        var rgbClassifier = ((r > 95) && (g > 40 && g < 100) && (b > 20) && ((Math.max(r, g, b) - Math.min(r, g, b)) > 15) && (Math.abs(r - g) > 15) && (r > g) && (r > b)),
            nurgb = this.toNormalizedRgb(r, g, b),
            nr = nurgb[0],
            ng = nurgb[1],
            nb = nurgb[2],
            normRgbClassifier = (((nr / ng) > 1.185) && (((r * b) / (Math.pow(r + g + b, 2))) > 0.107) && (((r * g) / (Math.pow(r + g + b, 2))) > 0.112)),
            hsv = this.toHsvTest(r, g, b),
            h = hsv[0],
            s = hsv[1],
            hsvClassifier = (h > 0 && h < 35 && s > 0.23 && s < 0.68);
        return (rgbClassifier || normRgbClassifier || hsvClassifier); // 
    }

    // rgb to hsv
    toHsv(r, g, b) {
        return [
            Math.acos((0.5 * ((r - g) + (r - b))) / (Math.sqrt((Math.pow((r - g), 2) + ((r - b) * (g - b)))))),
            1 - (3 * ((Math.min(r, g, b)) / (r + g + b))),
            (1 / 3) * (r + g + b)
        ];
    }

    toHsvTest(r, g, b) {
        var h = 0,
            mx = Math.max(r, g, b),
            mn = Math.min(r, g, b),
            dif = mx - mn;
        if (mx == r) {
            h = (g - b) / dif;
        } else if (mx == g) {
            h = 2 + ((g - r) / dif)
        } else {
            h = 4 + ((r - g) / dif);
        }
        h = h * 60;
        if (h < 0) {
            h = h + 360;
        }
        return [h, 1 - (3 * ((Math.min(r, g, b)) / (r + g + b))), (1 / 3) * (r + g + b)];
    }

    toNormalizedRgb(r, g, b) {
        var sum = r + g + b;
        return [(r / sum), (g / sum), (b / sum)];
    }
}


// TODO:
// build the bounding polygon by the regions edge values:
// Identify the leftmost, the uppermost, the rightmost, and the lowermost skin pixels of the three largest skin regions.
// Use these points as the corner points of a bounding polygon.

// TODO:
// check if the total skin count is less than 30% of the total number of pixels
// AND the number of skin pixels within the bounding polygon is less than 55% of the size of the polygon
// if this condition is true, it's not nude.

// TODO: include bounding polygon functionality
// if there are more than 60 skin regions and the average intensity within the polygon is less than 0.25
// the image is not nude

// toYcc(r, g, b) {
//     r /= 255, g /= 255, b /= 255;
//     var y = 0.299 * r + 0.587 * g + 0.114 * b,
//         cr = r - y,
//         cb = b - y;
//     return [y, cr, cb];
// }