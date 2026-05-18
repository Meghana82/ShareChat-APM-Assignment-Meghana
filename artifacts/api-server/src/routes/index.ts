import { Router, type IRouter } from "express";
import healthRouter from "./health";
import trendsRouter from "./trends";

const router: IRouter = Router();

router.use(healthRouter);
router.use(trendsRouter);

export default router;
