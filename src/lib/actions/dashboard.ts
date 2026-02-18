"use server";

import * as service from "@/features/dashboard/dashboard.service";

export async function getDashboardData(startDate?: Date, endDate?: Date) {
  return service.getDashboardData(startDate, endDate);
}

export async function getTopProducts(limit = 5) {
  return service.getTopProducts(limit);
}
