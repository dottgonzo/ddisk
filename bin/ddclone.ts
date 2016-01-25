import clone = require("../index");


let source = process.argv[2];
let dest = process.argv[3];


if (source) {
    clone(source, dest).then(function() {
        console.log("ok");
    }).catch(function(err) {
        throw Error(err);
    });
} else {
    throw Error("missing source");
}




