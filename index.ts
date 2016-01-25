import * as Promise from "bluebird";
import * as child_process from "child_process";

let exec = child_process.exec;
let spawn = child_process.spawn;

function shacheck(path: string, bs?: string, count?: string) {
    return new Promise(function(resolve, reject) {

if(bs&&count){
            exec("dd if="+path+ " bs=" + bs + " count=" + count + " | sha1sum ", function(err, stdout, stderr) {
            resolve(stdout);
        });
}else{
            exec("sha1sum " + path, function(err, stdout, stderr) {
            resolve(stdout);
        });
}





    });
}

function clone(source, dest) {
    return new Promise(function(resolve, reject) {



        let disk = false;


        if (source.split("dev/") == 2) {

            disk = source;

        } else if (dest.split("dev/") == 2) {
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

                        shacheck(dest, bs, count).then(function(sha2) {
                            if (sha1 == sha2) {
                                resolve(true);
                            } else {
                                reject("sha don't match");
                            }

                        });
                    });
                });
            });

        } else {


            let cmd = "dd if=" + source + " of=" + dest;

            console.log(cmd);

            shacheck(source).then(function(sha1) {

                exec(cmd, function(err, stdout, stderr) {

                    shacheck(dest).then(function(sha2) {
                        if (sha1 == sha2) {
                            resolve(true);
                        } else {
                            reject("sha don't match");
                        }

                    });

                });
            });
        }

    });



}
