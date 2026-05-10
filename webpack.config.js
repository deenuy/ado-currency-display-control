const path = require("path");

module.exports = {
    target: "web",
    entry: {
        control: "./src/scripts/control.ts"
    },
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "[name].js",
        libraryTarget: "amd"
    },
    devtool: "source-map",
    externals: [
        /^VSS\/.*/, /^TFS\/.*/, /^q$/
    ],
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
        modules: [path.resolve(__dirname, "src/scripts"), "node_modules"]
    },
    module: {
        rules: [
            { test: /\.tsx?$/, loader: "ts-loader", exclude: /node_modules/ }
        ]
    }
};