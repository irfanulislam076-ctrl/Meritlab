import { Router } from "express";
import { z } from "zod";
import { CategoryModel, CourseModel } from "../models";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

export const catalogRouter = Router();

// Public: category list for the discovery screen.
catalogRouter.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const categories = await CategoryModel.find({ hidden: false }).sort({ sortOrder: 1 }).lean();
    res.json({ success: true, data: { categories } });
  }),
);

// Public: live courses, optionally filtered by category slug.
catalogRouter.get(
  "/courses",
  asyncHandler(async (req, res) => {
    const { category } = z.object({ category: z.string().trim().max(80).optional() }).parse(req.query);
    const filter: Record<string, unknown> = { status: "LIVE" };
    if (category) {
      const cat = await CategoryModel.findOne({ slug: category.toLowerCase() }).select("_id").lean();
      if (!cat) return res.json({ success: true, data: { courses: [] } });
      filter.categoryId = cat._id;
    }
    const courses = await CourseModel.find(filter).sort({ startDate: -1 }).lean();
    res.json({ success: true, data: { courses } });
  }),
);

catalogRouter.get(
  "/courses/:slug",
  asyncHandler(async (req, res) => {
    const slug = z.string().trim().min(1).max(120).parse(req.params.slug).toLowerCase();
    const course = await CourseModel.findOne({ slug, status: "LIVE" }).lean();
    if (!course) throw new ApiError(404, "Course not found");
    res.json({ success: true, data: { course } });
  }),
);
