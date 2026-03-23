import { Router } from "express";
import multer from "multer";
import * as reconController from "../controllers/reconciliation.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

// Multer en memoria: procesa el CSV sin escribir al disco
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB máximo
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se aceptan archivos CSV"));
    }
  },
});

router.use(authenticate);

// Solo gerente y contador acceden a reconciliación
router.use(authorize("gerente", "contador"));

router.post("/import",                upload.single("file"), reconController.importCsv);
router.get("/status",                                        reconController.getStatus);
router.get("/extractos",                                     reconController.listExtractos);
router.post("/match",                                        reconController.match);
router.delete("/match/:extractoId",                          reconController.unmatch);

export default router;
