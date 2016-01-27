var Promise = require("bluebird");
var pathExists = require("path-exists");
var child_process = require("child_process");
var exec = child_process.exec;
var spawn = child_process.spawn;
function shacheck(path, bs, count) {
    return new Promise(function (resolve, reject) {
        if (bs && count) {
            exec("dd if=" + path + " bs=" + bs + " count=" + count + " | sha1sum |awk '{print($1)}' ", function (err, stdout, stderr) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(stdout.toString("utf-8"));
                }
            });
        }
        else {
            exec("sha1sum " + path + " |awk '{print($1)}'", function (err, stdout, stderr) {
                if (err) {
                    reject(err);
                }
                else if (stderr) {
                    reject(stderr);
                }
                else {
                    resolve(stdout.toString("utf-8"));
                }
            });
        }
    });
}
function filesize(file) {
    return new Promise(function (resolve, reject) {
        exec("du -b " + file, function (err, stdout, stderr) {
            if (err) {
                reject(err);
            }
            else if (stderr) {
                reject(stderr);
            }
            else {
                resolve(parseInt(stdout.toString("utf-8")));
            }
        });
    });
}
function disksize(disk) {
    return new Promise(function (resolve, reject) {
        exec("fdisk " + disk + " -l | grep " + disk + ":| awk {'print($5)'}", function (err, stdout, stderr) {
            if (err) {
                reject(err);
            }
            else if (stderr) {
                reject(stderr);
            }
            else {
                resolve(parseInt(stdout.toString("utf-8")));
            }
        });
    });
}
function diskbusysize(disk) {
    return new Promise(function (resolve, reject) {
        exec("fdisk " + disk + " -l", function (err, stdout, stderr) {
            if (err) {
                reject(err);
            }
            else if (stderr) {
                reject(stderr);
            }
            else {
                var fdiskstring = stdout.toString("utf-8");
                var fdisklines = fdiskstring.split("\n");
                var bs = parseInt(fdisklines[2].replace(/ +(?= )/g, "").split(" ")[3]);
                var count = parseInt(fdisklines[fdisklines.length - 2].replace(/ +(?= )/g, "").split(" ")[2]) + 1;
                resolve(bs * count);
            }
        });
    });
}
function freespace(file) {
    return new Promise(function (resolve, reject) {
        var folder = file.replace("/" + file.split("/")[file.split("/").length - 1], "");
        exec("df -k " + folder + "| tail -1 | awk {'print$(4)'}", function (err, stdout, stderr) {
            if (err) {
                reject(err);
            }
            else if (stderr) {
                reject(stderr);
            }
            else {
                console.log(stdout);
                resolve(parseInt(stdout.toString("utf-8")) * 1024);
            }
        });
    });
}
function checkspace(source, dest) {
    return new Promise(function (resolve, reject) {
        if (source.split("dev/").length == 2) {
            diskbusysize(source).then(function (sourcesize) {
                console.log("source size= " + sourcesize);
                if (dest.split("dev/").length == 2) {
                    disksize(dest).then(function (sizedest) {
                        if (sourcesize < sizedest) {
                            console.log("size ok");
                            resolve(true);
                        }
                        else {
                            reject("insufficient space on " + dest);
                        }
                    }).catch(function (err) {
                        reject(err);
                    });
                }
                else {
                    freespace(dest).then(function (sizedest) {
                        console.log("free space is " + sizedest);
                        if (sourcesize < sizedest) {
                            resolve(true);
                        }
                        else {
                            reject("insufficient space on " + dest);
                        }
                    }).catch(function (err) {
                        reject(err);
                    });
                }
            }).catch(function (err) {
                reject(err);
            });
        }
        else {
            filesize(source).then(function (sizesource) {
                if (dest.split("dev/").length == 2) {
                    disksize(dest).then(function (sizedest) {
                        if (sizesource < sizedest) {
                            resolve(true);
                        }
                        else {
                            reject("insufficient space on " + dest);
                        }
                    }).catch(function (err) {
                        reject(err);
                    });
                }
                else {
                    freespace(dest).then(function (sizedest) {
                        if (sizesource < sizedest) {
                            resolve(true);
                        }
                        else {
                            reject("insufficient space on " + dest);
                        }
                    }).catch(function (err) {
                        reject(err);
                    });
                }
            }).catch(function (err) {
                reject(err);
            });
        }
    });
}
function umount_drive(disk) {
    return new Promise(function (resolve, reject) {
        exec("cat /proc/mounts | grep " + disk + " | awk {'print$(1)'}", function (err, stdout, stderr) {
            if (err) {
                reject(err);
            }
            else if (stderr) {
                reject(stderr);
            }
            else {
                var drives = "";
                var fdiskstring = stdout.toString("utf-8");
                var fdisklines = fdiskstring.split("\n");
                for (var i = 0; i < fdisklines.length; i++) {
                    drives = drives + fdisklines[i] + " ";
                }
                if (fdisklines[0] != "") {
                    console.log("umount partitions: " + drives);
                    exec("umount " + drives, function (err, stdout, stderr) {
                        if (err) {
                            reject(err);
                        }
                        else if (stderr) {
                            reject(stderr);
                        }
                        else {
                            resolve(true);
                        }
                    });
                }
                else {
                    resolve(true);
                }
            }
        });
    });
}
function umountall(source, dest) {
    return new Promise(function (resolve, reject) {
        if (source.split("dev/").length == 2) {
            umount_drive(source).then(function () {
                if (dest.split("dev/").length == 2) {
                    umount_drive(dest).then(function () {
                        resolve(true);
                    }).catch(function (err) {
                        reject(err);
                    });
                }
                else {
                    resolve(true);
                }
            }).catch(function (err) {
                reject(err);
            });
        }
        else {
            if (dest.split("dev/").length == 2) {
                umount_drive(dest).then(function () {
                    resolve(true);
                }).catch(function (err) {
                    reject(err);
                });
            }
            else {
                resolve(true);
            }
        }
    });
}
module.exports = function (source, dest, progress) {
    console.log("starting");
    return new Promise(function (resolve, reject) {
        if (!source || !pathExists.sync(source)) {
            reject("missing source");
        }
        else if (!dest) {
            reject("missing dest");
        }
        else if (dest.split("dev/").length == 2 && !pathExists.sync(dest)) {
            reject("missing dest");
        }
        else {
            console.log("file and disk exists");
            umountall(source, dest).then(function () {
                console.log("checking space...");
                checkspace(source, dest).then(function () {
                    console.log("cloning...");
                    if (source.split("dev/").length == 2) {
                        exec("fdisk " + source + " -l", function (err, stdout, stderr) {
                            if (err) {
                                reject(err);
                            }
                            else if (stderr) {
                                reject(stderr);
                            }
                            else {
                                var fdiskstring = stdout.toString("utf-8");
                                var fdisklines = fdiskstring.split("\n");
                                var bs = parseInt(fdisklines[2].replace(/ +(?= )/g, "").split(" ")[3]);
                                var count = parseInt(fdisklines[fdisklines.length - 2].replace(/ +(?= )/g, "").split(" ")[2]);
                                var cmd = "dd if=" + source + " bs=" + bs + " count=" + count + " of=" + dest;
                                console.log(cmd);
                                shacheck(source, bs, count).then(function (sha1) {
                                    exec(cmd, function (err, stdout, stderr) {
                                        if (err) {
                                            reject(err);
                                        }
                                        else {
                                            shacheck(dest, bs, count).then(function (sha2) {
                                                if (sha1 == sha2) {
                                                    resolve(true);
                                                }
                                                else {
                                                    reject("shasum don't match");
                                                }
                                            }).catch(function (err) {
                                                reject(err);
                                            });
                                        }
                                    });
                                }).catch(function (err) {
                                    reject(err);
                                });
                            }
                        });
                    }
                    else {
                        var cmd = "dd if=" + source + " of=" + dest;
                        console.log(cmd);
                        shacheck(source).then(function (sha1) {
                            console.log("shasum " + source + ": " + sha1);
                            exec(cmd, function (err, stdout, stderr) {
                                if (err) {
                                    reject(err);
                                }
                                else {
                                    if (dest.split("dev/").length == 2) {
                                        exec("fdisk " + dest + " -l", function (err, stdout, stderr) {
                                            if (err) {
                                                reject(err);
                                            }
                                            else if (stderr) {
                                                reject(stderr);
                                            }
                                            else {
                                                filesize(source).then(function (sizesource) {
                                                    var fdiskstring = stdout.toString("utf-8");
                                                    var fdisklines = fdiskstring.split("\n");
                                                    var bs = parseInt(fdisklines[2].replace(/ +(?= )/g, "").split(" ")[3]);
                                                    var count = sizesource / bs;
                                                    console.log("bs= " + bs);
                                                    console.log("count= " + count);
                                                    shacheck(dest, bs, count).then(function (sha2) {
                                                        console.log("shasum " + dest + ": " + sha2);
                                                        if (sha1 == sha2) {
                                                            resolve(true);
                                                        }
                                                        else {
                                                            reject("shasum don't match");
                                                        }
                                                    }).catch(function (err) {
                                                        reject(err);
                                                    });
                                                }).catch(function (err) {
                                                    reject(err);
                                                });
                                            }
                                        });
                                    }
                                    else {
                                        shacheck(dest).then(function (sha2) {
                                            console.log("shasum " + dest + ": " + sha2);
                                            if (sha1 == sha2) {
                                                resolve(true);
                                            }
                                            else {
                                                reject("shasum don't match");
                                            }
                                        }).catch(function (err) {
                                            reject(err);
                                        });
                                    }
                                }
                            });
                        }).catch(function (err) {
                            reject(err);
                        });
                    }
                }).catch(function (err) {
                    reject(err);
                });
            }).catch(function (err) {
                reject(err);
            });
        }
    });
};

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluZGV4LnRzIl0sIm5hbWVzIjpbInNoYWNoZWNrIiwiZmlsZXNpemUiLCJkaXNrc2l6ZSIsImRpc2tidXN5c2l6ZSIsImZyZWVzcGFjZSIsImNoZWNrc3BhY2UiLCJ1bW91bnRfZHJpdmUiLCJ1bW91bnRhbGwiXSwibWFwcGluZ3MiOiJBQUFBLElBQVksT0FBTyxXQUFNLFVBQVUsQ0FBQyxDQUFBO0FBQ3BDLElBQVksVUFBVSxXQUFNLGFBQWEsQ0FBQyxDQUFBO0FBQzFDLElBQVksYUFBYSxXQUFNLGVBQWUsQ0FBQyxDQUFBO0FBRS9DLElBQUksSUFBSSxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUM7QUFDOUIsSUFBSSxLQUFLLEdBQUcsYUFBYSxDQUFDLEtBQUssQ0FBQztBQUVoQyxrQkFBa0IsSUFBWSxFQUFFLEVBQVcsRUFBRSxLQUFjO0lBQ3ZEQSxNQUFNQSxDQUFDQSxJQUFJQSxPQUFPQSxDQUFTQSxVQUFTQSxPQUFPQSxFQUFFQSxNQUFNQTtRQUUvQyxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNkLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxHQUFHLE1BQU0sR0FBRyxFQUFFLEdBQUcsU0FBUyxHQUFHLEtBQUssR0FBRyxnQ0FBZ0MsRUFBRSxVQUFTLEdBQUcsRUFBRSxNQUFNLEVBQUUsTUFBTTtnQkFFbkgsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztvQkFDTixNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBRWhCLENBQUM7Z0JBQUMsSUFBSSxDQUFDLENBQUM7b0JBRUosT0FBTyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDdEMsQ0FBQztZQUNMLENBQUMsQ0FBQyxDQUFDO1FBQ1AsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ0osSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLEdBQUcscUJBQXFCLEVBQUUsVUFBUyxHQUFHLEVBQUUs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NENBQzdCLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxHQUFHLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDLENBQUM7NENBQzVDLEVBQUUsQ0FBQyxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDO2dEQUNmLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQzs0Q0FDbEIsQ0FBQzs0Q0FBQyxJQUFJLENBQUMsQ0FBQztnREFDSixNQUFNLENBQUMsb0JBQW9CLENBQUMsQ0FBQzs0Q0FDakMsQ0FBQzt3Q0FFTCxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBUyxHQUFHOzRDQUNqQixNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7d0NBQ2hCLENBQUMsQ0FBQyxDQUFDO29DQUlQLENBQUM7Z0NBRUwsQ0FBQzs0QkFDTCxDQUFDLENBQUMsQ0FBQzt3QkFDUCxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBUyxHQUFHOzRCQUNqQixNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7d0JBQ2hCLENBQUMsQ0FBQyxDQUFDO29CQUNQLENBQUM7Z0JBRUwsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFVBQVMsR0FBRztvQkFDakIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUNoQixDQUFDLENBQUMsQ0FBQztZQUNQLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFTLEdBQUc7Z0JBQ2pCLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNoQixDQUFDLENBQUMsQ0FBQztRQUdQLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztBQUlQLENBQUMsQ0FBQSIsImZpbGUiOiJpbmRleC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIFByb21pc2UgZnJvbSBcImJsdWViaXJkXCI7XG5pbXBvcnQgKiBhcyBwYXRoRXhpc3RzIGZyb20gXCJwYXRoLWV4aXN0c1wiO1xuaW1wb3J0ICogYXMgY2hpbGRfcHJvY2VzcyBmcm9tIFwiY2hpbGRfcHJvY2Vzc1wiO1xuXG5sZXQgZXhlYyA9IGNoaWxkX3Byb2Nlc3MuZXhlYztcbmxldCBzcGF3biA9IGNoaWxkX3Byb2Nlc3Muc3Bhd247XG5cbmZ1bmN0aW9uIHNoYWNoZWNrKHBhdGg6IHN0cmluZywgYnM/OiBudW1iZXIsIGNvdW50PzogbnVtYmVyKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZz4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG5cbiAgICAgICAgaWYgKGJzICYmIGNvdW50KSB7XG4gICAgICAgICAgICBleGVjKFwiZGQgaWY9XCIgKyBwYXRoICsgXCIgYnM9XCIgKyBicyArIFwiIGNvdW50PVwiICsgY291bnQgKyBcIiB8IHNoYTFzdW0gfGF3ayAne3ByaW50KCQxKX0nIFwiLCBmdW5jdGlvbihlcnIsIHN0ZG91dCwgc3RkZXJyKSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHN0ZG91dC50b1N0cmluZyhcInV0Zi04XCIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV4ZWMoXCJzaGExc3VtIFwiICsgcGF0aCArIFwiIHxhd2sgJ3twcmludCgkMSl9J1wiLCBmdW5jdGlvbihlcnIsIHN0ZG91dCwgc3RkZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHN0ZGVycikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3Qoc3RkZXJyKTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShzdGRvdXQudG9TdHJpbmcoXCJ1dGYtOFwiKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gZmlsZXNpemUoZmlsZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPG51bWJlcj4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIGV4ZWMoXCJkdSAtYiBcIiArIGZpbGUsIGZ1bmN0aW9uKGVyciwgc3Rkb3V0LCBzdGRlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RkZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KHN0ZGVycik7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShwYXJzZUludChzdGRvdXQudG9TdHJpbmcoXCJ1dGYtOFwiKSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gZGlza3NpemUoZGlzazogc3RyaW5nKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPG51bWJlcj4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIGV4ZWMoXCJmZGlzayBcIiArIGRpc2sgKyBcIiAtbCB8IGdyZXAgXCIgKyBkaXNrICsgXCI6fCBhd2sgeydwcmludCgkNSknfVwiLCBmdW5jdGlvbihlcnIsIHN0ZG91dCwgc3RkZXJyKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHN0ZGVycikge1xuICAgICAgICAgICAgICAgIHJlamVjdChzdGRlcnIpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc29sdmUocGFyc2VJbnQoc3Rkb3V0LnRvU3RyaW5nKFwidXRmLThcIikpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIGRpc2tidXN5c2l6ZShkaXNrOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8bnVtYmVyPihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgZXhlYyhcImZkaXNrIFwiICsgZGlzayArIFwiIC1sXCIsIGZ1bmN0aW9uKGVyciwgc3Rkb3V0LCBzdGRlcnIpIHsgLy8gZ2V0IGRpc2sgc291cmNlIHNpemUgdGFraW5nIHRoZSBsYXN0IGJsb2NrIG9mIGxhc3QgcGFydGl0aW9uXG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHN0ZGVycikge1xuICAgICAgICAgICAgICAgIHJlamVjdChzdGRlcnIpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG5cbiAgICAgICAgICAgICAgICBsZXQgZmRpc2tzdHJpbmcgPSBzdGRvdXQudG9TdHJpbmcoXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgICAgICBsZXQgZmRpc2tsaW5lcyA9IGZkaXNrc3RyaW5nLnNwbGl0KFwiXFxuXCIpO1xuICAgICAgICAgICAgICAgIGxldCBicyA9IHBhcnNlSW50KGZkaXNrbGluZXNbMl0ucmVwbGFjZSgvICsoPz0gKS9nLCBcIlwiKS5zcGxpdChcIiBcIilbM10pO1xuICAgICAgICAgICAgICAgIGxldCBjb3VudCA9IHBhcnNlSW50KGZkaXNrbGluZXNbZmRpc2tsaW5lcy5sZW5ndGggLSAyXS5yZXBsYWNlKC8gKyg/PSApL2csIFwiXCIpLnNwbGl0KFwiIFwiKVsyXSkgKyAxO1xuXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShicyAqIGNvdW50KTtcblxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9KTtcbn1cblxuXG5mdW5jdGlvbiBmcmVlc3BhY2UoZmlsZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPG51bWJlcj4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIGxldCBmb2xkZXIgPSBmaWxlLnJlcGxhY2UoXCIvXCIgKyBmaWxlLnNwbGl0KFwiL1wiKVtmaWxlLnNwbGl0KFwiL1wiKS5sZW5ndGggLSAxXSwgXCJcIik7XG4gICAgICAgIGV4ZWMoXCJkZiAtayBcIiArIGZvbGRlciArIFwifCB0YWlsIC0xIHwgYXdrIHsncHJpbnQkKDQpJ31cIiwgZnVuY3Rpb24oZXJyLCBzdGRvdXQsIHN0ZGVycikge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChzdGRlcnIpIHtcbiAgICAgICAgICAgICAgICByZWplY3Qoc3RkZXJyKTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhzdGRvdXQpO1xuICAgICAgICAgICAgICAgIHJlc29sdmUocGFyc2VJbnQoc3Rkb3V0LnRvU3RyaW5nKFwidXRmLThcIikpICogMTAyNCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG5cbmZ1bmN0aW9uIGNoZWNrc3BhY2Uoc291cmNlOiBzdHJpbmcsIGRlc3Q6IHN0cmluZykge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxib29sZWFuPihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgaWYgKHNvdXJjZS5zcGxpdChcImRldi9cIikubGVuZ3RoID09IDIpIHtcbiAgICAgICAgICAgIGRpc2tidXN5c2l6ZShzb3VyY2UpLnRoZW4oZnVuY3Rpb24oc291cmNlc2l6ZSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwic291cmNlIHNpemU9IFwiICsgc291cmNlc2l6ZSk7XG4gICAgICAgICAgICAgICAgaWYgKGRlc3Quc3BsaXQoXCJkZXYvXCIpLmxlbmd0aCA9PSAyKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgZGlza3NpemUoZGVzdCkudGhlbihmdW5jdGlvbihzaXplZGVzdCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc291cmNlc2l6ZSA8IHNpemVkZXN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJzaXplIG9rXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChcImluc3VmZmljaWVudCBzcGFjZSBvbiBcIiArIGRlc3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgIGZyZWVzcGFjZShkZXN0KS50aGVuKGZ1bmN0aW9uKHNpemVkZXN0KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZnJlZSBzcGFjZSBpcyBcIiArIHNpemVkZXN0KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNvdXJjZXNpemUgPCBzaXplZGVzdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChcImluc3VmZmljaWVudCBzcGFjZSBvbiBcIiArIGRlc3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICB9KTtcblxuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmaWxlc2l6ZShzb3VyY2UpLnRoZW4oZnVuY3Rpb24oc2l6ZXNvdXJjZSkge1xuXG4gICAgICAgICAgICAgICAgaWYgKGRlc3Quc3BsaXQoXCJkZXYvXCIpLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgICAgICAgICAgICAgIGRpc2tzaXplKGRlc3QpLnRoZW4oZnVuY3Rpb24oc2l6ZWRlc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzaXplc291cmNlIDwgc2l6ZWRlc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoXCJpbnN1ZmZpY2llbnQgc3BhY2Ugb24gXCIgKyBkZXN0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgZnJlZXNwYWNlKGRlc3QpLnRoZW4oZnVuY3Rpb24oc2l6ZWRlc3QpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNpemVzb3VyY2UgPCBzaXplZGVzdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChcImluc3VmZmljaWVudCBzcGFjZSBvbiBcIiArIGRlc3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICB9XG4gICAgfSk7XG59XG5cblxuZnVuY3Rpb24gdW1vdW50X2RyaXZlKGRpc2spIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8Ym9vbGVhbj4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIGV4ZWMoXCJjYXQgL3Byb2MvbW91bnRzIHwgZ3JlcCBcIiArIGRpc2sgKyBcIiB8IGF3ayB7J3ByaW50JCgxKSd9XCIsIGZ1bmN0aW9uKGVyciwgc3Rkb3V0LCBzdGRlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RkZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KHN0ZGVycik7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGV0IGRyaXZlcyA9IFwiXCI7XG4gICAgICAgICAgICAgICAgbGV0IGZkaXNrc3RyaW5nID0gc3Rkb3V0LnRvU3RyaW5nKFwidXRmLThcIik7XG4gICAgICAgICAgICAgICAgdmFyIGZkaXNrbGluZXMgPSBmZGlza3N0cmluZy5zcGxpdChcIlxcblwiKTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZkaXNrbGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgZHJpdmVzID0gZHJpdmVzICsgZmRpc2tsaW5lc1tpXSArIFwiIFwiO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChmZGlza2xpbmVzWzBdICE9IFwiXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJ1bW91bnQgcGFydGl0aW9uczogXCIgKyBkcml2ZXMpO1xuICAgICAgICAgICAgICAgICAgICBleGVjKFwidW1vdW50IFwiICsgZHJpdmVzLCBmdW5jdGlvbihlcnIsIHN0ZG91dCwgc3RkZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHN0ZGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChzdGRlcnIpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG5cblxuZnVuY3Rpb24gdW1vdW50YWxsKHNvdXJjZTogc3RyaW5nLCBkZXN0OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8Ym9vbGVhbj4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIGlmIChzb3VyY2Uuc3BsaXQoXCJkZXYvXCIpLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgICAgICB1bW91bnRfZHJpdmUoc291cmNlKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGlmIChkZXN0LnNwbGl0KFwiZGV2L1wiKS5sZW5ndGggPT0gMikge1xuICAgICAgICAgICAgICAgICAgICB1bW91bnRfZHJpdmUoZGVzdCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChkZXN0LnNwbGl0KFwiZGV2L1wiKS5sZW5ndGggPT0gMikge1xuICAgICAgICAgICAgICAgIHVtb3VudF9kcml2ZShkZXN0KS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cblxuXG4gICAgfSk7XG59XG5cblxuZXhwb3J0ID1mdW5jdGlvbihzb3VyY2U6IHN0cmluZywgZGVzdDogc3RyaW5nLCBwcm9ncmVzcz86IEZ1bmN0aW9uKSB7XG4gICAgY29uc29sZS5sb2coXCJzdGFydGluZ1wiKTtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8Ym9vbGVhbj4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIGlmICghc291cmNlIHx8ICFwYXRoRXhpc3RzLnN5bmMoc291cmNlKSkge1xuICAgICAgICAgICAgcmVqZWN0KFwibWlzc2luZyBzb3VyY2VcIik7XG4gICAgICAgIH0gZWxzZSBpZiAoIWRlc3QpIHtcbiAgICAgICAgICAgIHJlamVjdChcIm1pc3NpbmcgZGVzdFwiKTtcbiAgICAgICAgfSBlbHNlIGlmIChkZXN0LnNwbGl0KFwiZGV2L1wiKS5sZW5ndGggPT0gMiAmJiAhcGF0aEV4aXN0cy5zeW5jKGRlc3QpKSB7XG4gICAgICAgICAgICByZWplY3QoXCJtaXNzaW5nIGRlc3RcIik7XG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZmlsZSBhbmQgZGlzayBleGlzdHNcIik7XG5cblxuICAgICAgICAgICAgdW1vdW50YWxsKHNvdXJjZSwgZGVzdCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImNoZWNraW5nIHNwYWNlLi4uXCIpO1xuICAgICAgICAgICAgICAgIGNoZWNrc3BhY2Uoc291cmNlLCBkZXN0KS50aGVuKGZ1bmN0aW9uKCkge1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiY2xvbmluZy4uLlwiKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoc291cmNlLnNwbGl0KFwiZGV2L1wiKS5sZW5ndGggPT0gMikge1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWMoXCJmZGlzayBcIiArIHNvdXJjZSArIFwiIC1sXCIsIGZ1bmN0aW9uKGVyciwgc3Rkb3V0LCBzdGRlcnIpIHtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHN0ZGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3Qoc3RkZXJyKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBmZGlza3N0cmluZyA9IHN0ZG91dC50b1N0cmluZyhcInV0Zi04XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZmRpc2tsaW5lcyA9IGZkaXNrc3RyaW5nLnNwbGl0KFwiXFxuXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgYnMgPSBwYXJzZUludChmZGlza2xpbmVzWzJdLnJlcGxhY2UoLyArKD89ICkvZywgXCJcIikuc3BsaXQoXCIgXCIpWzNdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGNvdW50ID0gcGFyc2VJbnQoZmRpc2tsaW5lc1tmZGlza2xpbmVzLmxlbmd0aCAtIDJdLnJlcGxhY2UoLyArKD89ICkvZywgXCJcIikuc3BsaXQoXCIgXCIpWzJdKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgY21kID0gXCJkZCBpZj1cIiArIHNvdXJjZSArIFwiIGJzPVwiICsgYnMgKyBcIiBjb3VudD1cIiArIGNvdW50ICsgXCIgb2Y9XCIgKyBkZXN0O1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNtZCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hhY2hlY2soc291cmNlLCBicywgY291bnQpLnRoZW4oZnVuY3Rpb24oc2hhMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlYyhjbWQsIGZ1bmN0aW9uKGVyciwgc3Rkb3V0LCBzdGRlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hhY2hlY2soZGVzdCwgYnMsIGNvdW50KS50aGVuKGZ1bmN0aW9uKHNoYTIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzaGExID09IHNoYTIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoXCJzaGFzdW0gZG9uJ3QgbWF0Y2hcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGNtZCA9IFwiZGQgaWY9XCIgKyBzb3VyY2UgKyBcIiBvZj1cIiArIGRlc3Q7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNtZCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHNoYWNoZWNrKHNvdXJjZSkudGhlbihmdW5jdGlvbihzaGExKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJzaGFzdW0gXCIgKyBzb3VyY2UgKyBcIjogXCIgKyBzaGExKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjKGNtZCwgZnVuY3Rpb24oZXJyLCBzdGRvdXQsIHN0ZGVycikge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGVzdC5zcGxpdChcImRldi9cIikubGVuZ3RoID09IDIpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWMoXCJmZGlzayBcIiArIGRlc3QgKyBcIiAtbFwiLCBmdW5jdGlvbihlcnIsIHN0ZG91dCwgc3RkZXJyKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RkZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3Qoc3RkZXJyKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlc2l6ZShzb3VyY2UpLnRoZW4oZnVuY3Rpb24oc2l6ZXNvdXJjZSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGZkaXNrc3RyaW5nID0gc3Rkb3V0LnRvU3RyaW5nKFwidXRmLThcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGZkaXNrbGluZXMgPSBmZGlza3N0cmluZy5zcGxpdChcIlxcblwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgYnMgPSBwYXJzZUludChmZGlza2xpbmVzWzJdLnJlcGxhY2UoLyArKD89ICkvZywgXCJcIikuc3BsaXQoXCIgXCIpWzNdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgY291bnQgPSBzaXplc291cmNlIC8gYnM7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiYnM9IFwiICsgYnMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiY291bnQ9IFwiICsgY291bnQpO1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaGFjaGVjayhkZXN0LCBicywgY291bnQpLnRoZW4oZnVuY3Rpb24oc2hhMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInNoYXN1bSBcIiArIGRlc3QgKyBcIjogXCIgKyBzaGEyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNoYTEgPT0gc2hhMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChcInNoYXN1bSBkb24ndCBtYXRjaFwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuXG5cblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hhY2hlY2soZGVzdCkudGhlbihmdW5jdGlvbihzaGEyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwic2hhc3VtIFwiICsgZGVzdCArIFwiOiBcIiArIHNoYTIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2hhMSA9PSBzaGEyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KFwic2hhc3VtIGRvbid0IG1hdGNoXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICB9KTtcblxuXG4gICAgICAgIH1cbiAgICB9KTtcblxuXG5cbn1cbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
