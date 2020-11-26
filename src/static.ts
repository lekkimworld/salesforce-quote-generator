import express, {Application} from "express";
import path from "path";

export default (app : Application, dirPath : string = "public") => {
    app.use(express.static(path.join(__dirname, '..', dirPath)));
}
