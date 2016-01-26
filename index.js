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
                    console.log("shasum with blocks=" + stdout);
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
                    console.log("shasum=" + stdout.toString("utf-8"));
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
                if (fdisklines[0] != '') {
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
                            console.log(sha1);
                            exec(cmd, function (err, stdout, stderr) {
                                if (err) {
                                    console.log("error");
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
                                                    console.log(sha2);
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
                                            console.log(sha2);
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluZGV4LnRzIl0sIm5hbWVzIjpbInNoYWNoZWNrIiwiZmlsZXNpemUiLCJkaXNrc2l6ZSIsImRpc2tidXN5c2l6ZSIsImZyZWVzcGFjZSIsImNoZWNrc3BhY2UiLCJ1bW91bnRfZHJpdmUiLCJ1bW91bnRhbGwiXSwibWFwcGluZ3MiOiJBQUFBLElBQVksT0FBTyxXQUFNLFVBQVUsQ0FBQyxDQUFBO0FBQ3BDLElBQVksVUFBVSxXQUFNLGFBQWEsQ0FBQyxDQUFBO0FBQzFDLElBQVksYUFBYSxXQUFNLGVBQWUsQ0FBQyxDQUFBO0FBRS9DLElBQUksSUFBSSxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUM7QUFDOUIsSUFBSSxLQUFLLEdBQUcsYUFBYSxDQUFDLEtBQUssQ0FBQztBQUVoQyxrQkFBa0IsSUFBWSxFQUFFLEVBQVcsRUFBRSxLQUFjO0lBQ3ZEQSxNQUFNQSxDQUFDQSxJQUFJQSxPQUFPQSxDQUFTQSxVQUFTQSxPQUFPQSxFQUFFQSxNQUFNQTtRQUUvQyxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNkLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxHQUFHLE1BQU0sR0FBRyxFQUFFLEdBQUcsU0FBUyxHQUFHLEtBQUssR0FBRyxnQ0FBZ0MsRUFBRSxVQUFTLEdBQUcsRUFBRSxNQUFNLEVBQUUsTUFBTTtnQkFFbkgsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztvQkFDTixNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBRWhCLENBQUM7Z0JBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ0osT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsR0FBRyxNQUFNLENBQUMsQ0FBQTtvQkFDM0MsT0FBTyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDdEMsQ0FBQztZQUNMLENBQUMsQ0FBQyxDQUFDO1FBQ1AsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ0osSUFB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R1AsQ0FBQzt3Q0FFTCxDQUFDLENBQUMsQ0FBQztvQ0FNUCxDQUFDO29DQUFDLElBQUksQ0FBQyxDQUFDO3dDQUVKLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBUyxJQUFJOzRDQUM3QixPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFBOzRDQUNqQixFQUFFLENBQUMsQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQztnREFDZixPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7NENBQ2xCLENBQUM7NENBQUMsSUFBSSxDQUFDLENBQUM7Z0RBQ0osTUFBTSxDQUFDLG9CQUFvQixDQUFDLENBQUM7NENBQ2pDLENBQUM7d0NBRUwsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFVBQVMsR0FBRzs0Q0FDakIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO3dDQUNoQixDQUFDLENBQUMsQ0FBQztvQ0FJUCxDQUFDO2dDQUVMLENBQUM7NEJBQ0wsQ0FBQyxDQUFDLENBQUM7d0JBQ1AsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFVBQVMsR0FBRzs0QkFDakIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO3dCQUNoQixDQUFDLENBQUMsQ0FBQztvQkFDUCxDQUFDO2dCQUVMLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFTLEdBQUc7b0JBQ2pCLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDaEIsQ0FBQyxDQUFDLENBQUM7WUFDUCxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBUyxHQUFHO2dCQUNqQixNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDaEIsQ0FBQyxDQUFDLENBQUM7UUFHUCxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7QUFJUCxDQUFDLENBQUEiLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBQcm9taXNlIGZyb20gXCJibHVlYmlyZFwiO1xuaW1wb3J0ICogYXMgcGF0aEV4aXN0cyBmcm9tIFwicGF0aC1leGlzdHNcIjtcbmltcG9ydCAqIGFzIGNoaWxkX3Byb2Nlc3MgZnJvbSBcImNoaWxkX3Byb2Nlc3NcIjtcblxubGV0IGV4ZWMgPSBjaGlsZF9wcm9jZXNzLmV4ZWM7XG5sZXQgc3Bhd24gPSBjaGlsZF9wcm9jZXNzLnNwYXduO1xuXG5mdW5jdGlvbiBzaGFjaGVjayhwYXRoOiBzdHJpbmcsIGJzPzogbnVtYmVyLCBjb3VudD86IG51bWJlcikge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxzdHJpbmc+KGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuXG4gICAgICAgIGlmIChicyAmJiBjb3VudCkge1xuICAgICAgICAgICAgZXhlYyhcImRkIGlmPVwiICsgcGF0aCArIFwiIGJzPVwiICsgYnMgKyBcIiBjb3VudD1cIiArIGNvdW50ICsgXCIgfCBzaGExc3VtIHxhd2sgJ3twcmludCgkMSl9JyBcIiwgZnVuY3Rpb24oZXJyLCBzdGRvdXQsIHN0ZGVycikge1xuXG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwic2hhc3VtIHdpdGggYmxvY2tzPVwiICsgc3Rkb3V0KVxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHN0ZG91dC50b1N0cmluZyhcInV0Zi04XCIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV4ZWMoXCJzaGExc3VtIFwiICsgcGF0aCArIFwiIHxhd2sgJ3twcmludCgkMSl9J1wiLCBmdW5jdGlvbihlcnIsIHN0ZG91dCwgc3RkZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHN0ZGVycikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3Qoc3RkZXJyKTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwic2hhc3VtPVwiICsgc3Rkb3V0LnRvU3RyaW5nKFwidXRmLThcIikpXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoc3Rkb3V0LnRvU3RyaW5nKFwidXRmLThcIikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIGZpbGVzaXplKGZpbGU6IHN0cmluZykge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxudW1iZXI+KGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICBleGVjKFwibHMgLXMgXCIgKyBmaWxlLCBmdW5jdGlvbihlcnIsIHN0ZG91dCwgc3RkZXJyKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHN0ZGVycikge1xuICAgICAgICAgICAgICAgIHJlamVjdChzdGRlcnIpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc29sdmUocGFyc2VJbnQoc3Rkb3V0LnRvU3RyaW5nKFwidXRmLThcIikpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIGRpc2tzaXplKGRpc2s6IHN0cmluZykge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxudW1iZXI+KGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICBleGVjKFwiZWNobyAkKCggJChzdWRvIGZkaXNrIFwiICsgZGlzayArIFwiIC1sIHwgZ3JlcCBcIiArIGRpc2sgKyBcIjp8IGF3ayB7J3ByaW50KCQ1KSd9KSAvIDEwMjQgKSlcIiwgZnVuY3Rpb24oZXJyLCBzdGRvdXQsIHN0ZGVycikge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChzdGRlcnIpIHtcbiAgICAgICAgICAgICAgICByZWplY3Qoc3RkZXJyKTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHBhcnNlSW50KHN0ZG91dC50b1N0cmluZyhcInV0Zi04XCIpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBkaXNrYnVzeXNpemUoZGlzazogc3RyaW5nKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPG51bWJlcj4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIGV4ZWMoXCJmZGlzayBcIiArIGRpc2sgKyBcIiAtbFwiLCBmdW5jdGlvbihlcnIsIHN0ZG91dCwgc3RkZXJyKSB7IC8vIGdldCBkaXNrIHNvdXJjZSBzaXplIHRha2luZyB0aGUgbGFzdCBibG9jayBvZiBsYXN0IHBhcnRpdGlvblxuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChzdGRlcnIpIHtcbiAgICAgICAgICAgICAgICByZWplY3Qoc3RkZXJyKTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcblxuXG4gICAgICAgICAgICAgICAgbGV0IGZkaXNrc3RyaW5nID0gc3Rkb3V0LnRvU3RyaW5nKFwidXRmLThcIik7XG4gICAgICAgICAgICAgICAgbGV0IGZkaXNrbGluZXMgPSBmZGlza3N0cmluZy5zcGxpdChcIlxcblwiKTtcbiAgICAgICAgICAgICAgICBsZXQgYnMgPSBwYXJzZUludChmZGlza2xpbmVzWzJdLnJlcGxhY2UoLyArKD89ICkvZywgXCJcIikuc3BsaXQoXCIgXCIpWzNdKTtcbiAgICAgICAgICAgICAgICBsZXQgY291bnQgPSBwYXJzZUludChmZGlza2xpbmVzW2ZkaXNrbGluZXMubGVuZ3RoIC0gMl0ucmVwbGFjZSgvICsoPz0gKS9nLCBcIlwiKS5zcGxpdChcIiBcIilbMl0pKzE7XG5cbiAgICAgICAgICAgICAgICByZXNvbHZlKChicyAqIGNvdW50KSAvIDEwMjQpO1xuXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG5cbmZ1bmN0aW9uIGZyZWVzcGFjZShmaWxlOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8bnVtYmVyPihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgbGV0IGZvbGRlciA9IGZpbGUucmVwbGFjZShcIi9cIiArIGZpbGUuc3BsaXQoXCIvXCIpW2ZpbGUuc3BsaXQoXCIvXCIpLmxlbmd0aCAtIDFdLCBcIlwiKVxuICAgICAgICBleGVjKFwiZGYgLWsgXCIgKyBmb2xkZXIgKyBcInwgdGFpbCAtMSB8IGF3ayB7J3ByaW50JCg0KSd9XCIsIGZ1bmN0aW9uKGVyciwgc3Rkb3V0LCBzdGRlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RkZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KHN0ZGVycik7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coc3Rkb3V0KTtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHBhcnNlSW50KHN0ZG91dC50b1N0cmluZyhcInV0Zi04XCIpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG5cbmZ1bmN0aW9uIGNoZWNrc3BhY2Uoc291cmNlOiBzdHJpbmcsIGRlc3Q6IHN0cmluZykge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxib29sZWFuPihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgaWYgKHNvdXJjZS5zcGxpdChcImRldi9cIikubGVuZ3RoID09IDIpIHtcbiAgICAgICAgICAgIGRpc2tidXN5c2l6ZShzb3VyY2UpLnRoZW4oZnVuY3Rpb24oc291cmNlc2l6ZSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwic291cmNlIHNpemU9IFwiICsgc291cmNlc2l6ZSlcbiAgICAgICAgICAgICAgICBpZiAoZGVzdC5zcGxpdChcImRldi9cIikubGVuZ3RoID09IDIpIHtcblxuICAgICAgICAgICAgICAgICAgICBkaXNrc2l6ZShkZXN0KS50aGVuKGZ1bmN0aW9uKHNpemVkZXN0KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzb3VyY2VzaXplIDwgc2l6ZWRlc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInNpemUgb2tcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoXCJpbnN1ZmZpY2llbnQgc3BhY2Ugb24gXCIgKyBkZXN0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICBmcmVlc3BhY2UoZGVzdCkudGhlbihmdW5jdGlvbihzaXplZGVzdCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImZyZWUgc3BhY2UgaXMgXCIgKyBzaXplZGVzdClcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNvdXJjZXNpemUgPCBzaXplZGVzdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChcImluc3VmZmljaWVudCBzcGFjZSBvbiBcIiArIGRlc3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICB9KTtcblxuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmaWxlc2l6ZShzb3VyY2UpLnRoZW4oZnVuY3Rpb24oc2l6ZXNvdXJjZSkge1xuXG4gICAgICAgICAgICAgICAgaWYgKGRlc3Quc3BsaXQoXCJkZXYvXCIpLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgICAgICAgICAgICAgIGRpc2tzaXplKGRlc3QpLnRoZW4oZnVuY3Rpb24oc2l6ZWRlc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzaXplc291cmNlIDwgc2l6ZWRlc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoXCJpbnN1ZmZpY2llbnQgc3BhY2Ugb24gXCIgKyBkZXN0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgZnJlZXNwYWNlKGRlc3QpLnRoZW4oZnVuY3Rpb24oc2l6ZWRlc3QpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNpemVzb3VyY2UgPCBzaXplZGVzdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChcImluc3VmZmljaWVudCBzcGFjZSBvbiBcIiArIGRlc3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICB9XG4gICAgfSk7XG59XG5cblxuZnVuY3Rpb24gdW1vdW50X2RyaXZlKGRpc2spIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8Ym9vbGVhbj4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIGV4ZWMoXCJjYXQgL3Byb2MvbW91bnRzIHwgZ3JlcCBcIiArIGRpc2sgKyBcIiB8IGF3ayB7J3ByaW50JCgxKSd9XCIsIGZ1bmN0aW9uKGVyciwgc3Rkb3V0LCBzdGRlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RkZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KHN0ZGVycik7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGV0IGRyaXZlcyA9IFwiXCI7XG4gICAgICAgICAgICAgICAgbGV0IGZkaXNrc3RyaW5nID0gc3Rkb3V0LnRvU3RyaW5nKFwidXRmLThcIik7XG4gICAgICAgICAgICAgICAgdmFyIGZkaXNrbGluZXMgPSBmZGlza3N0cmluZy5zcGxpdChcIlxcblwiKTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZkaXNrbGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgZHJpdmVzID0gZHJpdmVzICsgZmRpc2tsaW5lc1tpXSArIFwiIFwiO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChmZGlza2xpbmVzWzBdIT0nJykge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInVtb3VudCBwYXJ0aXRpb25zOiBcIitkcml2ZXMpXG4gICAgICAgICAgICAgICAgICAgIGV4ZWMoXCJ1bW91bnQgXCIgKyBkcml2ZXMsIGZ1bmN0aW9uKGVyciwgc3Rkb3V0LCBzdGRlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RkZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHN0ZGVycik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9KTtcbn1cblxuXG5mdW5jdGlvbiB1bW91bnRhbGwoc291cmNlOiBzdHJpbmcsIGRlc3Q6IHN0cmluZykge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxib29sZWFuPihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgaWYgKHNvdXJjZS5zcGxpdChcImRldi9cIikubGVuZ3RoID09IDIpIHtcbiAgICAgICAgICAgIHVtb3VudF9kcml2ZShzb3VyY2UpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgaWYgKGRlc3Quc3BsaXQoXCJkZXYvXCIpLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgICAgICAgICAgICAgIHVtb3VudF9kcml2ZShkZXN0KS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGRlc3Quc3BsaXQoXCJkZXYvXCIpLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgICAgICAgICAgdW1vdW50X2RyaXZlKGRlc3QpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuXG5cbiAgICB9KTtcbn1cblxuXG5leHBvcnQgPWZ1bmN0aW9uKHNvdXJjZTogc3RyaW5nLCBkZXN0OiBzdHJpbmcsIHByb2dyZXNzPzogRnVuY3Rpb24pIHtcbiAgICBjb25zb2xlLmxvZyhcInN0YXJ0aW5nXCIpXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPGJvb2xlYW4+KGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICBpZiAoIXNvdXJjZSB8fCAhcGF0aEV4aXN0cy5zeW5jKHNvdXJjZSkpIHtcbiAgICAgICAgICAgIHJlamVjdChcIm1pc3Npbmcgc291cmNlXCIpO1xuICAgICAgICB9IGVsc2UgaWYgKCFkZXN0KSB7XG4gICAgICAgICAgICByZWplY3QoXCJtaXNzaW5nIGRlc3RcIik7XG4gICAgICAgIH0gZWxzZSBpZiAoZGVzdC5zcGxpdChcImRldi9cIikubGVuZ3RoID09IDIgJiYgIXBhdGhFeGlzdHMuc3luYyhkZXN0KSkge1xuICAgICAgICAgICAgcmVqZWN0KFwibWlzc2luZyBkZXN0XCIpO1xuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcImZpbGUgYW5kIGRpc2sgZXhpc3RzXCIpXG5cblxuICAgICAgICAgICAgdW1vdW50YWxsKHNvdXJjZSwgZGVzdCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImNoZWNraW5nIHNwYWNlLi4uXCIpXG4gICAgICAgICAgICAgICAgY2hlY2tzcGFjZShzb3VyY2UsIGRlc3QpLnRoZW4oZnVuY3Rpb24oKSB7XG5cbmNvbnNvbGUubG9nKFwiY2xvbmluZy4uLlwiKVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChzb3VyY2Uuc3BsaXQoXCJkZXYvXCIpLmxlbmd0aCA9PSAyKSB7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgZXhlYyhcImZkaXNrIFwiICsgc291cmNlICsgXCIgLWxcIiwgZnVuY3Rpb24oZXJyLCBzdGRvdXQsIHN0ZGVycikge1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RkZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChzdGRlcnIpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGZkaXNrc3RyaW5nID0gc3Rkb3V0LnRvU3RyaW5nKFwidXRmLThcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBmZGlza2xpbmVzID0gZmRpc2tzdHJpbmcuc3BsaXQoXCJcXG5cIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBicyA9IHBhcnNlSW50KGZkaXNrbGluZXNbMl0ucmVwbGFjZSgvICsoPz0gKS9nLCBcIlwiKS5zcGxpdChcIiBcIilbM10pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgY291bnQgPSBwYXJzZUludChmZGlza2xpbmVzW2ZkaXNrbGluZXMubGVuZ3RoIC0gMl0ucmVwbGFjZSgvICsoPz0gKS9nLCBcIlwiKS5zcGxpdChcIiBcIilbMl0pKzE7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGNtZCA9IFwiZGQgaWY9XCIgKyBzb3VyY2UgKyBcIiBicz1cIiArIGJzICsgXCIgY291bnQ9XCIgKyBjb3VudCArIFwiIG9mPVwiICsgZGVzdDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhjbWQpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNoYWNoZWNrKHNvdXJjZSwgYnMsIGNvdW50KS50aGVuKGZ1bmN0aW9uKHNoYTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWMoY21kLCBmdW5jdGlvbihlcnIsIHN0ZG91dCwgc3RkZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNoYWNoZWNrKGRlc3QsIGJzLCBjb3VudCkudGhlbihmdW5jdGlvbihzaGEyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2hhMSA9PSBzaGEyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KFwic2hhc3VtIGRvbid0IG1hdGNoXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBjbWQgPSBcImRkIGlmPVwiICsgc291cmNlICsgXCIgb2Y9XCIgKyBkZXN0O1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhjbWQpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBzaGFjaGVjayhzb3VyY2UpLnRoZW4oZnVuY3Rpb24oc2hhMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHNoYTEpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlYyhjbWQsIGZ1bmN0aW9uKGVyciwgc3Rkb3V0LCBzdGRlcnIpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImVycm9yXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkZXN0LnNwbGl0KFwiZGV2L1wiKS5sZW5ndGggPT0gMikge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlYyhcImZkaXNrIFwiICsgc291cmNlICsgXCIgLWxcIiwgZnVuY3Rpb24oZXJyLCBzdGRvdXQsIHN0ZGVycikge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHN0ZGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHN0ZGVycik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBmZGlza3N0cmluZyA9IHN0ZG91dC50b1N0cmluZyhcInV0Zi04XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGZkaXNrbGluZXMgPSBmZGlza3N0cmluZy5zcGxpdChcIlxcblwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBicyA9IHBhcnNlSW50KGZkaXNrbGluZXNbMl0ucmVwbGFjZSgvICsoPz0gKS9nLCBcIlwiKS5zcGxpdChcIiBcIilbM10pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGNvdW50ID0gcGFyc2VJbnQoZmRpc2tsaW5lc1tmZGlza2xpbmVzLmxlbmd0aCAtIDJdLnJlcGxhY2UoLyArKD89ICkvZywgXCJcIikuc3BsaXQoXCIgXCIpWzJdKTtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImJzPSBcIiArIGJzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJjb3VudD0gXCIgKyBjb3VudClcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaGFjaGVjayhkZXN0LCBicywgY291bnQrMSkudGhlbihmdW5jdGlvbihzaGEyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coc2hhMilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2hhMSA9PSBzaGEyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KFwic2hhc3VtIGRvbid0IG1hdGNoXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG5cblxuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaGFjaGVjayhkZXN0KS50aGVuKGZ1bmN0aW9uKHNoYTIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coc2hhMilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNoYTEgPT0gc2hhMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChcInNoYXN1bSBkb24ndCBtYXRjaFwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICB9XG4gICAgfSk7XG5cblxuXG59XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
