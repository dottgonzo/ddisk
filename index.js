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
        exec("ls -s " + file, function (err, stdout, stderr) {
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
        exec("echo $(( $(sudo fdisk " + disk + " -l | grep " + disk + ":| awk {'print($5)'}) / 1024 ))", function (err, stdout, stderr) {
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
                resolve((bs * count) / 1024);
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
                resolve(parseInt(stdout.toString("utf-8")));
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
                                var count = parseInt(fdisklines[fdisklines.length - 2].replace(/ +(?= )/g, "").split(" ")[2]) + 1;
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
                                                console.log("bs= " + bs);
                                                console.log("count= " + count);
                                                shacheck(dest, bs, count + 1).then(function (sha2) {
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluZGV4LnRzIl0sIm5hbWVzIjpbInNoYWNoZWNrIiwiZmlsZXNpemUiLCJkaXNrc2l6ZSIsImRpc2tidXN5c2l6ZSIsImZyZWVzcGFjZSIsImNoZWNrc3BhY2UiLCJ1bW91bnRfZHJpdmUiLCJ1bW91bnRhbGwiXSwibWFwcGluZ3MiOiJBQUFBLElBQVksT0FBTyxXQUFNLFVBQVUsQ0FBQyxDQUFBO0FBQ3BDLElBQVksVUFBVSxXQUFNLGFBQWEsQ0FBQyxDQUFBO0FBQzFDLElBQVksYUFBYSxXQUFNLGVBQWUsQ0FBQyxDQUFBO0FBRS9DLElBQUksSUFBSSxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUM7QUFDOUIsSUFBSSxLQUFLLEdBQUcsYUFBYSxDQUFDLEtBQUssQ0FBQztBQUVoQyxrQkFBa0IsSUFBWSxFQUFFLEVBQVcsRUFBRSxLQUFjO0lBQ3ZEQSxNQUFNQSxDQUFDQSxJQUFJQSxPQUFPQSxDQUFTQSxVQUFTQSxPQUFPQSxFQUFFQSxNQUFNQTtRQUUvQyxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNkLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxHQUFHLE1BQU0sR0FBRyxFQUFFLEdBQUcsU0FBUyxHQUFHLEtBQUssR0FBRyxnQ0FBZ0MsRUFBRSxVQUFTLEdBQUcsRUFBRSxNQUFNLEVBQUUsTUFBTTtnQkFFbkgsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztvQkFDTixNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBRWhCLENBQUM7Z0JBQUMsSUFBSSxDQUFDLENBQUM7b0JBRUosT0FBTyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDdEMsQ0FBQztZQUNMLENBQUMsQ0FBQyxDQUFDO1FBQ1AsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ0osSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLEdBQUcscUJBQXFCLEVBQUUsVUFBUyxHQUFHLEVBQUUs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NENBQzdCLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxHQUFHLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDLENBQUM7NENBQzVDLEVBQUUsQ0FBQyxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDO2dEQUNmLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQzs0Q0FDbEIsQ0FBQzs0Q0FBQyxJQUFJLENBQUMsQ0FBQztnREFDSixNQUFNLENBQUMsb0JBQW9CLENBQUMsQ0FBQzs0Q0FDakMsQ0FBQzt3Q0FFTCxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBUyxHQUFHOzRDQUNqQixNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7d0NBQ2hCLENBQUMsQ0FBQyxDQUFDO29DQUlQLENBQUM7Z0NBRUwsQ0FBQzs0QkFDTCxDQUFDLENBQUMsQ0FBQzt3QkFDUCxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBUyxHQUFHOzRCQUNqQixNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7d0JBQ2hCLENBQUMsQ0FBQyxDQUFDO29CQUNQLENBQUM7Z0JBRUwsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFVBQVMsR0FBRztvQkFDakIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUNoQixDQUFDLENBQUMsQ0FBQztZQUNQLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFTLEdBQUc7Z0JBQ2pCLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNoQixDQUFDLENBQUMsQ0FBQztRQUdQLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztBQUlQLENBQUMsQ0FBQSIsImZpbGUiOiJpbmRleC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIFByb21pc2UgZnJvbSBcImJsdWViaXJkXCI7XG5pbXBvcnQgKiBhcyBwYXRoRXhpc3RzIGZyb20gXCJwYXRoLWV4aXN0c1wiO1xuaW1wb3J0ICogYXMgY2hpbGRfcHJvY2VzcyBmcm9tIFwiY2hpbGRfcHJvY2Vzc1wiO1xuXG5sZXQgZXhlYyA9IGNoaWxkX3Byb2Nlc3MuZXhlYztcbmxldCBzcGF3biA9IGNoaWxkX3Byb2Nlc3Muc3Bhd247XG5cbmZ1bmN0aW9uIHNoYWNoZWNrKHBhdGg6IHN0cmluZywgYnM/OiBudW1iZXIsIGNvdW50PzogbnVtYmVyKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZz4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG5cbiAgICAgICAgaWYgKGJzICYmIGNvdW50KSB7XG4gICAgICAgICAgICBleGVjKFwiZGQgaWY9XCIgKyBwYXRoICsgXCIgYnM9XCIgKyBicyArIFwiIGNvdW50PVwiICsgY291bnQgKyBcIiB8IHNoYTFzdW0gfGF3ayAne3ByaW50KCQxKX0nIFwiLCBmdW5jdGlvbihlcnIsIHN0ZG91dCwgc3RkZXJyKSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHN0ZG91dC50b1N0cmluZyhcInV0Zi04XCIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV4ZWMoXCJzaGExc3VtIFwiICsgcGF0aCArIFwiIHxhd2sgJ3twcmludCgkMSl9J1wiLCBmdW5jdGlvbihlcnIsIHN0ZG91dCwgc3RkZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHN0ZGVycikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3Qoc3RkZXJyKTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShzdGRvdXQudG9TdHJpbmcoXCJ1dGYtOFwiKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gZmlsZXNpemUoZmlsZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPG51bWJlcj4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIGV4ZWMoXCJscyAtcyBcIiArIGZpbGUsIGZ1bmN0aW9uKGVyciwgc3Rkb3V0LCBzdGRlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RkZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KHN0ZGVycik7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShwYXJzZUludChzdGRvdXQudG9TdHJpbmcoXCJ1dGYtOFwiKSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gZGlza3NpemUoZGlzazogc3RyaW5nKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPG51bWJlcj4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIGV4ZWMoXCJlY2hvICQoKCAkKHN1ZG8gZmRpc2sgXCIgKyBkaXNrICsgXCIgLWwgfCBncmVwIFwiICsgZGlzayArIFwiOnwgYXdrIHsncHJpbnQoJDUpJ30pIC8gMTAyNCApKVwiLCBmdW5jdGlvbihlcnIsIHN0ZG91dCwgc3RkZXJyKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHN0ZGVycikge1xuICAgICAgICAgICAgICAgIHJlamVjdChzdGRlcnIpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc29sdmUocGFyc2VJbnQoc3Rkb3V0LnRvU3RyaW5nKFwidXRmLThcIikpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIGRpc2tidXN5c2l6ZShkaXNrOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8bnVtYmVyPihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgZXhlYyhcImZkaXNrIFwiICsgZGlzayArIFwiIC1sXCIsIGZ1bmN0aW9uKGVyciwgc3Rkb3V0LCBzdGRlcnIpIHsgLy8gZ2V0IGRpc2sgc291cmNlIHNpemUgdGFraW5nIHRoZSBsYXN0IGJsb2NrIG9mIGxhc3QgcGFydGl0aW9uXG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHN0ZGVycikge1xuICAgICAgICAgICAgICAgIHJlamVjdChzdGRlcnIpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG5cbiAgICAgICAgICAgICAgICBsZXQgZmRpc2tzdHJpbmcgPSBzdGRvdXQudG9TdHJpbmcoXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgICAgICBsZXQgZmRpc2tsaW5lcyA9IGZkaXNrc3RyaW5nLnNwbGl0KFwiXFxuXCIpO1xuICAgICAgICAgICAgICAgIGxldCBicyA9IHBhcnNlSW50KGZkaXNrbGluZXNbMl0ucmVwbGFjZSgvICsoPz0gKS9nLCBcIlwiKS5zcGxpdChcIiBcIilbM10pO1xuICAgICAgICAgICAgICAgIGxldCBjb3VudCA9IHBhcnNlSW50KGZkaXNrbGluZXNbZmRpc2tsaW5lcy5sZW5ndGggLSAyXS5yZXBsYWNlKC8gKyg/PSApL2csIFwiXCIpLnNwbGl0KFwiIFwiKVsyXSkgKyAxO1xuXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgoYnMgKiBjb3VudCkgLyAxMDI0KTtcblxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9KTtcbn1cblxuXG5mdW5jdGlvbiBmcmVlc3BhY2UoZmlsZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPG51bWJlcj4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIGxldCBmb2xkZXIgPSBmaWxlLnJlcGxhY2UoXCIvXCIgKyBmaWxlLnNwbGl0KFwiL1wiKVtmaWxlLnNwbGl0KFwiL1wiKS5sZW5ndGggLSAxXSwgXCJcIik7XG4gICAgICAgIGV4ZWMoXCJkZiAtayBcIiArIGZvbGRlciArIFwifCB0YWlsIC0xIHwgYXdrIHsncHJpbnQkKDQpJ31cIiwgZnVuY3Rpb24oZXJyLCBzdGRvdXQsIHN0ZGVycikge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChzdGRlcnIpIHtcbiAgICAgICAgICAgICAgICByZWplY3Qoc3RkZXJyKTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhzdGRvdXQpO1xuICAgICAgICAgICAgICAgIHJlc29sdmUocGFyc2VJbnQoc3Rkb3V0LnRvU3RyaW5nKFwidXRmLThcIikpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG5cblxuZnVuY3Rpb24gY2hlY2tzcGFjZShzb3VyY2U6IHN0cmluZywgZGVzdDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPGJvb2xlYW4+KGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICBpZiAoc291cmNlLnNwbGl0KFwiZGV2L1wiKS5sZW5ndGggPT0gMikge1xuICAgICAgICAgICAgZGlza2J1c3lzaXplKHNvdXJjZSkudGhlbihmdW5jdGlvbihzb3VyY2VzaXplKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJzb3VyY2Ugc2l6ZT0gXCIgKyBzb3VyY2VzaXplKTtcbiAgICAgICAgICAgICAgICBpZiAoZGVzdC5zcGxpdChcImRldi9cIikubGVuZ3RoID09IDIpIHtcblxuICAgICAgICAgICAgICAgICAgICBkaXNrc2l6ZShkZXN0KS50aGVuKGZ1bmN0aW9uKHNpemVkZXN0KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzb3VyY2VzaXplIDwgc2l6ZWRlc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInNpemUgb2tcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KFwiaW5zdWZmaWNpZW50IHNwYWNlIG9uIFwiICsgZGVzdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgZnJlZXNwYWNlKGRlc3QpLnRoZW4oZnVuY3Rpb24oc2l6ZWRlc3QpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJmcmVlIHNwYWNlIGlzIFwiICsgc2l6ZWRlc3QpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc291cmNlc2l6ZSA8IHNpemVkZXN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KFwiaW5zdWZmaWNpZW50IHNwYWNlIG9uIFwiICsgZGVzdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH0pO1xuXG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZpbGVzaXplKHNvdXJjZSkudGhlbihmdW5jdGlvbihzaXplc291cmNlKSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoZGVzdC5zcGxpdChcImRldi9cIikubGVuZ3RoID09IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgZGlza3NpemUoZGVzdCkudGhlbihmdW5jdGlvbihzaXplZGVzdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNpemVzb3VyY2UgPCBzaXplZGVzdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChcImluc3VmZmljaWVudCBzcGFjZSBvbiBcIiArIGRlc3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICBmcmVlc3BhY2UoZGVzdCkudGhlbihmdW5jdGlvbihzaXplZGVzdCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2l6ZXNvdXJjZSA8IHNpemVkZXN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KFwiaW5zdWZmaWNpZW50IHNwYWNlIG9uIFwiICsgZGVzdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICB9KTtcblxuXG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuXG5mdW5jdGlvbiB1bW91bnRfZHJpdmUoZGlzaykge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxib29sZWFuPihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgZXhlYyhcImNhdCAvcHJvYy9tb3VudHMgfCBncmVwIFwiICsgZGlzayArIFwiIHwgYXdrIHsncHJpbnQkKDEpJ31cIiwgZnVuY3Rpb24oZXJyLCBzdGRvdXQsIHN0ZGVycikge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChzdGRlcnIpIHtcbiAgICAgICAgICAgICAgICByZWplY3Qoc3RkZXJyKTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXQgZHJpdmVzID0gXCJcIjtcbiAgICAgICAgICAgICAgICBsZXQgZmRpc2tzdHJpbmcgPSBzdGRvdXQudG9TdHJpbmcoXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgICAgICB2YXIgZmRpc2tsaW5lcyA9IGZkaXNrc3RyaW5nLnNwbGl0KFwiXFxuXCIpO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZmRpc2tsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBkcml2ZXMgPSBkcml2ZXMgKyBmZGlza2xpbmVzW2ldICsgXCIgXCI7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGZkaXNrbGluZXNbMF0gIT0gXCJcIikge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInVtb3VudCBwYXJ0aXRpb25zOiBcIiArIGRyaXZlcyk7XG4gICAgICAgICAgICAgICAgICAgIGV4ZWMoXCJ1bW91bnQgXCIgKyBkcml2ZXMsIGZ1bmN0aW9uKGVyciwgc3Rkb3V0LCBzdGRlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RkZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHN0ZGVycik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9KTtcbn1cblxuXG5mdW5jdGlvbiB1bW91bnRhbGwoc291cmNlOiBzdHJpbmcsIGRlc3Q6IHN0cmluZykge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxib29sZWFuPihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgaWYgKHNvdXJjZS5zcGxpdChcImRldi9cIikubGVuZ3RoID09IDIpIHtcbiAgICAgICAgICAgIHVtb3VudF9kcml2ZShzb3VyY2UpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgaWYgKGRlc3Quc3BsaXQoXCJkZXYvXCIpLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgICAgICAgICAgICAgIHVtb3VudF9kcml2ZShkZXN0KS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGRlc3Quc3BsaXQoXCJkZXYvXCIpLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgICAgICAgICAgdW1vdW50X2RyaXZlKGRlc3QpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuXG5cbiAgICB9KTtcbn1cblxuXG5leHBvcnQgPWZ1bmN0aW9uKHNvdXJjZTogc3RyaW5nLCBkZXN0OiBzdHJpbmcsIHByb2dyZXNzPzogRnVuY3Rpb24pIHtcbiAgICBjb25zb2xlLmxvZyhcInN0YXJ0aW5nXCIpO1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxib29sZWFuPihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgaWYgKCFzb3VyY2UgfHwgIXBhdGhFeGlzdHMuc3luYyhzb3VyY2UpKSB7XG4gICAgICAgICAgICByZWplY3QoXCJtaXNzaW5nIHNvdXJjZVwiKTtcbiAgICAgICAgfSBlbHNlIGlmICghZGVzdCkge1xuICAgICAgICAgICAgcmVqZWN0KFwibWlzc2luZyBkZXN0XCIpO1xuICAgICAgICB9IGVsc2UgaWYgKGRlc3Quc3BsaXQoXCJkZXYvXCIpLmxlbmd0aCA9PSAyICYmICFwYXRoRXhpc3RzLnN5bmMoZGVzdCkpIHtcbiAgICAgICAgICAgIHJlamVjdChcIm1pc3NpbmcgZGVzdFwiKTtcbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJmaWxlIGFuZCBkaXNrIGV4aXN0c1wiKTtcblxuXG4gICAgICAgICAgICB1bW91bnRhbGwoc291cmNlLCBkZXN0KS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiY2hlY2tpbmcgc3BhY2UuLi5cIik7XG4gICAgICAgICAgICAgICAgY2hlY2tzcGFjZShzb3VyY2UsIGRlc3QpLnRoZW4oZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJjbG9uaW5nLi4uXCIpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChzb3VyY2Uuc3BsaXQoXCJkZXYvXCIpLmxlbmd0aCA9PSAyKSB7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgZXhlYyhcImZkaXNrIFwiICsgc291cmNlICsgXCIgLWxcIiwgZnVuY3Rpb24oZXJyLCBzdGRvdXQsIHN0ZGVycikge1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RkZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChzdGRlcnIpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGZkaXNrc3RyaW5nID0gc3Rkb3V0LnRvU3RyaW5nKFwidXRmLThcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBmZGlza2xpbmVzID0gZmRpc2tzdHJpbmcuc3BsaXQoXCJcXG5cIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBicyA9IHBhcnNlSW50KGZkaXNrbGluZXNbMl0ucmVwbGFjZSgvICsoPz0gKS9nLCBcIlwiKS5zcGxpdChcIiBcIilbM10pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgY291bnQgPSBwYXJzZUludChmZGlza2xpbmVzW2ZkaXNrbGluZXMubGVuZ3RoIC0gMl0ucmVwbGFjZSgvICsoPz0gKS9nLCBcIlwiKS5zcGxpdChcIiBcIilbMl0pICsgMTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgY21kID0gXCJkZCBpZj1cIiArIHNvdXJjZSArIFwiIGJzPVwiICsgYnMgKyBcIiBjb3VudD1cIiArIGNvdW50ICsgXCIgb2Y9XCIgKyBkZXN0O1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNtZCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hhY2hlY2soc291cmNlLCBicywgY291bnQpLnRoZW4oZnVuY3Rpb24oc2hhMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlYyhjbWQsIGZ1bmN0aW9uKGVyciwgc3Rkb3V0LCBzdGRlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hhY2hlY2soZGVzdCwgYnMsIGNvdW50KS50aGVuKGZ1bmN0aW9uKHNoYTIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzaGExID09IHNoYTIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoXCJzaGFzdW0gZG9uJ3QgbWF0Y2hcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGNtZCA9IFwiZGQgaWY9XCIgKyBzb3VyY2UgKyBcIiBvZj1cIiArIGRlc3Q7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNtZCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHNoYWNoZWNrKHNvdXJjZSkudGhlbihmdW5jdGlvbihzaGExKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJzaGFzdW0gXCIgKyBzb3VyY2UgKyBcIjogXCIgKyBzaGExKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjKGNtZCwgZnVuY3Rpb24oZXJyLCBzdGRvdXQsIHN0ZGVycikge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGVzdC5zcGxpdChcImRldi9cIikubGVuZ3RoID09IDIpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWMoXCJmZGlzayBcIiArIHNvdXJjZSArIFwiIC1sXCIsIGZ1bmN0aW9uKGVyciwgc3Rkb3V0LCBzdGRlcnIpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChzdGRlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChzdGRlcnIpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZmRpc2tzdHJpbmcgPSBzdGRvdXQudG9TdHJpbmcoXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBmZGlza2xpbmVzID0gZmRpc2tzdHJpbmcuc3BsaXQoXCJcXG5cIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgYnMgPSBwYXJzZUludChmZGlza2xpbmVzWzJdLnJlcGxhY2UoLyArKD89ICkvZywgXCJcIikuc3BsaXQoXCIgXCIpWzNdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBjb3VudCA9IHBhcnNlSW50KGZkaXNrbGluZXNbZmRpc2tsaW5lcy5sZW5ndGggLSAyXS5yZXBsYWNlKC8gKyg/PSApL2csIFwiXCIpLnNwbGl0KFwiIFwiKVsyXSk7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJicz0gXCIgKyBicyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImNvdW50PSBcIiArIGNvdW50KTtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaGFjaGVjayhkZXN0LCBicywgY291bnQgKyAxKS50aGVuKGZ1bmN0aW9uKHNoYTIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInNoYXN1bSBcIiArIGRlc3QgKyBcIjogXCIgKyBzaGEyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2hhMSA9PSBzaGEyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KFwic2hhc3VtIGRvbid0IG1hdGNoXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG5cblxuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaGFjaGVjayhkZXN0KS50aGVuKGZ1bmN0aW9uKHNoYTIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJzaGFzdW0gXCIgKyBkZXN0ICsgXCI6IFwiICsgc2hhMik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzaGExID09IHNoYTIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoXCJzaGFzdW0gZG9uJ3QgbWF0Y2hcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH0pO1xuXG5cbiAgICAgICAgfVxuICAgIH0pO1xuXG5cblxufVxuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9
