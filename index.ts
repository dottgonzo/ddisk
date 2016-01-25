import * as Promise from "bluebird";
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

export =function(source: string, dest: string) {
    return new Promise<boolean>(function(resolve, reject) {

        let disk: any = false;

        if (source.split("dev/").length == 2) {

            disk = source;

        } else if (dest.split("dev/").length == 2) {
            disk = dest;
        }

        if (disk) {

            exec("fdisk -l | grep '" + disk + "' -A 2 ", function(err, stdout, stdin) {

                let fdiskstring = stdout.toString("utf-8");
                let fdisklines = fdiskstring.split("\n");
                let bs = fdisklines[2].replace(/ +(?= )/g, "").split(" ")[0];
                let count = fdisklines[2].replace(/ +(?= )/g, "").split(" ")[0];

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

    });



}
