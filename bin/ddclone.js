var clone = require("../index");
var source = process.argv[2];
var dest = process.argv[3];
clone(source, dest).then(function () {
    console.log("ok");
}).catch(function (err) {
    console.log("ERROR:", err);
});

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImJpbi9kZGNsb25lLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLElBQU8sS0FBSyxXQUFXLFVBQVUsQ0FBQyxDQUFDO0FBRW5DLElBQUksTUFBTSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDN0IsSUFBSSxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUV2QixLQUFLLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQztJQUNyQixPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3RCLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFTLEdBQUc7SUFDakIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUMsR0FBRyxDQUFDLENBQUM7QUFDOUIsQ0FBQyxDQUFDLENBQUMiLCJmaWxlIjoiYmluL2RkY2xvbmUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgY2xvbmUgPSByZXF1aXJlKFwiLi4vaW5kZXhcIik7XG5cbmxldCBzb3VyY2UgPSBwcm9jZXNzLmFyZ3ZbMl07XG5sZXQgZGVzdCA9IHByb2Nlc3MuYXJndlszXTtcblxuICAgIGNsb25lKHNvdXJjZSwgZGVzdCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJva1wiKTtcbiAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJFUlJPUjpcIixlcnIpO1xuICAgIH0pO1xuXG5cblxuXG5cbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
