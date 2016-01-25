import clone = require("../index");

let source = process.argv[2];
let dest = process.argv[3];

    clone(source, dest).then(function() {
        console.log("ok");
    }).catch(function(err) {
        console.log("ERROR:",err);
    });





