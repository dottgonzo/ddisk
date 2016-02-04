import * as Promise from "bluebird";
import * as pathExists from "path-exists";
import * as child_process from "child_process";

import lsDisks = require("ls-disks");

let exec = child_process.exec;
let spawn = child_process.spawn;

function shacheck(path: string, bs?: number, count?: number) {
    return new Promise<string>(function(resolve, reject) {

        if (bs && count) {
            exec("dd if=" + path + " bs=" + bs + " count=" + count + " | sha1sum |awk '{print($1)}' ", function(err, stdout, stderr) {

                if (err) {
                    reject(err);

                } else {

                    resolve(stdout.toString("utf-8"));
                }
            });
        } else {
            exec("sha1sum " + path + " |awk '{print($1)}'", function(err, stdout, stderr) {
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
        exec("du -b " + file, function(err, stdout, stderr) {
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





function freespace(file: string) {
    return new Promise<number>(function(resolve, reject) {
        let folder = file.replace("/" + file.split("/")[file.split("/").length - 1], "");
        exec("df -k " + folder + "| tail -1 | awk {'print$(4)'}", function(err, stdout, stderr) {
            if (err) {
                reject(err);
            } else if (stderr) {
                reject(stderr);

            } else {
                console.log(stdout);
                resolve(parseInt(stdout.toString("utf-8")) * 1024);
            }
        });
    });
}


function checkspace(source: string, dest: string) {
    let lsdisks = lsDisks.all();
    let diskdest: IDisk;
    let disksource: IDisk;


    for (let i = 0; i < lsdisks.length; i++) {
        if (source === lsdisks[i].disk) {
            disksource = lsdisks[i];
        } else if (dest === lsdisks[i].disk) {
            diskdest = lsdisks[i];
        }
    }


    return new Promise<boolean>(function(resolve, reject) {
        if (source.split("dev/").length === 2) {
            if (dest.split("dev/").length === 2) {



                if (disksource.used_blocks < diskdest.sectors) {
                    console.log("size ok");
                    resolve(true);
                } else {
                    reject("insufficient space on " + dest);
                }




            } else {

                freespace(dest).then(function(sizedest) {

                    console.log("free space is " + sizedest);

                    if (disksource.used_blocks * disksource.block < sizedest) {
                        resolve(true);
                    } else {
                        reject("insufficient space on " + dest);
                    }
                }).catch(function(err) {
                    reject(err);
                });
            }

        } else {
            filesize(source).then(function(sizesource) {

                if (dest.split("dev/").length === 2) {


                    if (sizesource < diskdest.size) {
                        resolve(true);
                    } else {
                        reject("insufficient space on " + dest);
                    }


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
        exec("cat /proc/mounts | grep " + disk + " | awk {'print$(1)'}", function(err, stdout, stderr) {
            if (err) {
                reject(err);
            } else if (stderr) {
                reject(stderr);

            } else {
                let drives = "";
                let fdiskstring = stdout.toString("utf-8");
                let fdisklines = fdiskstring.split("\n");
                for (let i = 0; i < fdisklines.length; i++) {
                    drives = drives + fdisklines[i] + " ";
                }

                if (fdisklines[0] !== "") {
                    console.log("umount partitions: " + drives);
                    exec("umount " + drives, function(err, stdout, stderr) {
                        if (err) {
                            reject(err);
                        } else if (stderr) {
                            reject(stderr);

                        } else {

                            resolve(true);
                        }
                    });
                } else {
                    resolve(true);
                }

            }
        });
    });
}


function umountall(source: string, dest: string) {
    return new Promise<boolean>(function(resolve, reject) {
        if (source.split("dev/").length === 2) {
            umount_drive(source).then(function() {
                if (dest.split("dev/").length === 2) {
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
            if (dest.split("dev/").length === 2) {
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

interface IPartition {
    partition: string;
    sectors: number;
    sectors_start: number;
    sectors_stop: number;
    type: string;
    boot: boolean;
    size: number;
}

interface IDisk {
    disk: string;
    sectors: number;
    size: number;
    partitions: IPartition[];
    block: number;
    used_blocks: number;
}

export = function(source: string, dest: string, progress?: Function) {
    console.log("starting");
    return new Promise<boolean>(function(resolve, reject) {
        if (!source || !pathExists.sync(source)) {
            reject("missing source");
        } else if (!dest) {
            reject("missing dest");
        } else if (dest.split("dev/").length === 2 && !pathExists.sync(dest)) {
            reject("missing dest");
        } else {

            let lsdisks: IDisk[] = lsDisks.all();
            let diskdest: IDisk;
            let disksource: IDisk;


            for (let i = 0; i < lsdisks.length; i++) {
                if (source === lsdisks[i].disk) {
                    disksource = lsdisks[i];
                } else if (dest === lsdisks[i].disk) {
                    diskdest = lsdisks[i];
                }
            }




            umountall(source, dest).then(function() {
                console.log("checking space...");
                checkspace(source, dest).then(function() {

                    console.log("cloning...");

                    if (source.split("dev/").length === 2) {








                        let CloneCmd = "dd if=" + source + " bs=" + disksource.block + " count=" + disksource.used_blocks + " of=" + dest;

                        console.log(CloneCmd);

                        shacheck(source, disksource.block, disksource.used_blocks).then(function(sha1) {
                            exec(CloneCmd, function(err, stdout, stderr) {
                                if (err) {
                                    reject(err);


                                } else {


                                    shacheck(dest, disksource.block, disksource.used_blocks).then(function(sha2) {
                                        if (sha1 === sha2) {
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


                    } else {


                        let CloneCmd = "dd if=" + source + " of=" + dest;

                        console.log(CloneCmd);

                        shacheck(source).then(function(sha1) {
                            console.log("shasum " + source + ": " + sha1);
                            exec(CloneCmd, function(err, stdout, stderr) {

                                if (err) {

                                    reject(err);

                                } else {


                                    if (dest.split("dev/").length === 2) {


                                        filesize(source).then(function(sizesource) {







                                            console.log("bs= " + diskdest.block);
                                            console.log("count= " + diskdest.used_blocks);


                                            shacheck(dest, diskdest.block, diskdest.used_blocks).then(function(sha2) {
                                                console.log("shasum " + dest + ": " + sha2);
                                                if (sha1 === sha2) {
                                                    resolve(true);
                                                } else {
                                                    reject("shasum don't match");
                                                }

                                            }).catch(function(err) {
                                                reject(err);
                                            });



                                        }).catch(function(err) {
                                            reject(err);
                                        });







                                    } else {

                                        shacheck(dest).then(function(sha2) {
                                            console.log("shasum " + dest + ": " + sha2);
                                            if (sha1 === sha2) {
                                                resolve(true);
                                            } else {
                                                reject("shasum don't match");
                                            }

                                        }).catch(function(err) {
                                            reject(err);
                                        });



                                    }

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
