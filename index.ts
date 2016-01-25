import * as Promise from "bluebird";
import * as pathExists from "path-exists";
import * as child_process from "child_process";

let exec = child_process.exec;
let spawn = child_process.spawn;

function shacheck(path: string, bs?: string, count?: string) {
    return new Promise<string>(function(resolve, reject) {

        if (bs && count) {
            exec("dd if=" + path + " bs=" + bs + " count=" + count + " | sha1sum ", function(err, stdout, stderr) {

                if (err) {
                    reject(err);
                } else if (stderr) {
                    reject(stderr);

                } else {
                    resolve(stdout.toString("utf-8"));
                }
            });
        } else {
            exec("sha1sum " + path, function(err, stdout, stderr) {
                if (err) {
                    reject(err);
                } else if (stderr) {
                    reject(stderr);

                } else {

                    resolve(stdout.toString("utf-8"));
                }
            });
        }
    });
}

function filesize(file: string) {
    return new Promise<number>(function(resolve, reject) {
        exec("ls -s " + file, function(err, stdout, stderr) {
            if (err) {
                reject(err);
            } else if (stderr) {
                reject(stderr);

            } else {
                resolve(parseInt(stdout.toString("utf-8")));
            }
        });
    });
}

function disksize(disk: string) {
    return new Promise<number>(function(resolve, reject) {
        exec("echo $(( $(sudo fdisk " + disk + " -l | grep " + disk + ":| awk {'print($5)'}) / 1024 ))", function(err, stdout, stderr) {
            if (err) {
                reject(err);
            } else if (stderr) {
                reject(stderr);

            } else {
                resolve(parseInt(stdout.toString("utf-8")));
            }
        });
    });
}

function diskbusysize(disk: string) {
    return new Promise<number>(function(resolve, reject) {
        exec("fdisk " + disk + "' -l", function(err, stdout, stderr) { // get disk source size taking the last block of last partition
            if (err) {
                reject(err);
            } else if (stderr) {
                reject(stderr);

            } else {


                let fdiskstring = stdout.toString("utf-8");
                let fdisklines = fdiskstring.split("\n");
                let bs = parseInt(fdisklines[2].replace(/ +(?= )/g, "").split(" ")[3]);
                let count = parseInt(fdisklines[fdisklines.length - 1].replace(/ +(?= )/g, "").split(" ")[3]);

                resolve((bs * count) / 1024);

            }
        });
    });
}


function freespace(file: string) {
    return new Promise<number>(function(resolve, reject) {
        exec("df -k " + file.split("/")[file.split("/").length - 1], function(err, stdout, stderr) {
            if (err) {
                reject(err);
            } else if (stderr) {
                reject(stderr);

            } else {
                resolve(parseInt(stdout.toString("utf-8")));
            }
        });
    });
}


function checkspace(source: string, dest: string) {
    return new Promise<boolean>(function(resolve, reject) {
        if (source.split("dev/").length == 2) {
            diskbusysize(source).then(function(sourcesize) {

                if (dest.split("dev/").length == 2) {

                    disksize(dest).then(function(sizedest) {

                        if (sourcesize < sizedest) {
                            resolve(true);
                        } else {
                            reject("insufficient space on " + dest);
                        }

                    }).catch(function(err) {
                        reject(err);
                    });


                } else {

                    freespace(dest).then(function(sizedest) {



                        if (sourcesize < sizedest) {
                            resolve(true);
                        } else {
                            reject("insufficient space on " + dest);
                        }
                    }).catch(function(err) {
                        reject(err);
                    });
                }


            }).catch(function(err) {
                reject(err);
            });


        } else {
            filesize(source).then(function(sizesource) {

                if (dest.split("dev/").length == 2) {
                    disksize(dest).then(function(sizedest) {
                        if (sizesource < sizedest) {
                            resolve(true);
                        } else {
                            reject("insufficient space on " + dest);
                        }
                    }).catch(function(err) {
                        reject(err);
                    });


                } else {

                    freespace(dest).then(function(sizedest) {

                        if (sizesource < sizedest) {
                            resolve(true);
                        } else {
                            reject("insufficient space on " + dest);
                        }

                    }).catch(function(err) {
                        reject(err);
                    });

                }


            }).catch(function(err) {
                reject(err);
            });


        }
    });
}


function umount_drive(disk) {
    return new Promise<boolean>(function(resolve, reject) {
        exec("cat /proc/mounts | grep " + disk, function(err, stdout, stderr) {
            if (err) {
                reject(err);
            } else if (stderr) {
                reject(stderr);

            } else {
                let drives = "";
                let fdiskstring = stdout.toString("utf-8");
                var fdisklines = fdiskstring.split("\n");
                for (var i = 0; i < fdisklines.length; i++) {
                    drives = drives + fdisklines[i] + " ";
                }
                exec("umount " + drives, function(err, stdout, stderr) {
                    if (err) {
                        reject(err);
                    } else if (stderr) {
                        reject(stderr);

                    } else {

                        resolve(true);
                    }
                });
            }
        });
    });
}


function umountall(source: string, dest: string) {
    return new Promise<boolean>(function(resolve, reject) {
        if (source.split("dev/").length == 2) {
            umount_drive(source).then(function() {
                if (dest.split("dev/").length == 2) {
                    umount_drive(dest).then(function() {
                        resolve(true);
                    }).catch(function(err) {
                        reject(err);
                    });
                } else {
                    resolve(true);
                }
            }).catch(function(err) {
                reject(err);
            });
        } else {
            if (dest.split("dev/").length == 2) {
                umount_drive(dest).then(function() {
                    resolve(true);
                }).catch(function(err) {
                    reject(err);
                });
            } else {
                resolve(true);
            }

        }



    });
}


export =function(source: string, dest: string, progress?: Function) {
    return new Promise<boolean>(function(resolve, reject) {
        if (!source || !pathExists.sync(source)) {
            reject("missing source");
        } else if (!dest) {
            reject("missing dest");
        } else {

            let disk: any = false;

            if (source.split("dev/").length == 2) {

                disk = source;

            } else if (dest.split("dev/").length == 2) {
                disk = dest;
                if (!pathExists.sync(dest)) {
                    reject("missing dest");
                }

            }
            umountall(source, dest).then(function() {
                checkspace(source, dest).then(function() {


                    if (disk) {


                        exec("fdisk " + disk + " -l", function(err, stdout, stderr) {


                            if (err) {
                                reject(err);
                            } else if (stderr) {
                                reject(stderr);

                            } else {



                                let fdiskstring = stdout.toString("utf-8");
                                let fdisklines = fdiskstring.split("\n");
                                let bs = fdisklines[2].replace(/ +(?= )/g, "").split(" ")[3];
                                let count = fdisklines[fdisklines.length - 1].replace(/ +(?= )/g, "").split(" ")[3];

                                let cmd = "dd if=" + source + " bs=" + bs + " count=" + count + " of=" + dest;

                                console.log(cmd);

                                shacheck(source, bs, count).then(function(sha1) {
                                    exec(cmd, function(err, stdout, stderr) {
                                        if (err) {
                                            reject(err);
                                        } else if (stderr) {
                                            reject(stderr);

                                        } else {


                                            shacheck(dest, bs, count).then(function(sha2) {
                                                if (sha1 == sha2) {
                                                    resolve(true);
                                                } else {
                                                    reject("shasum don't match");
                                                }

                                            }).catch(function(err) {
                                                reject(err);
                                            });
                                        }
                                    });
                                }).catch(function(err) {
                                    reject(err);
                                });
                            }
                        });

                    } else {


                        let cmd = "dd if=" + source + " of=" + dest;

                        console.log(cmd);

                        shacheck(source).then(function(sha1) {

                            exec(cmd, function(err, stdout, stderr) {

                                if (err) {
                                    reject(err);
                                } else if (stderr) {
                                    reject(stderr);

                                } else {


                                    shacheck(dest).then(function(sha2) {
                                        if (sha1 == sha2) {
                                            resolve(true);
                                        } else {
                                            reject("shasum don't match");
                                        }

                                    }).catch(function(err) {
                                        reject(err);
                                    });
                                }
                            });
                        }).catch(function(err) {
                            reject(err);
                        });
                    }

                }).catch(function(err) {
                    reject(err);
                });
            }).catch(function(err) {
                reject(err);
            });


        }
    });



}
