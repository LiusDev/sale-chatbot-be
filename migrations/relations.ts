import { relations } from "drizzle-orm/relations";
import { products, productImages, productGroups, systemUsers, aiAgents } from "./schema";

export const productImagesRelations = relations(productImages, ({one}) => ({
	product: one(products, {
		fields: [productImages.productId],
		references: [products.id]
	}),
}));

export const productsRelations = relations(products, ({one, many}) => ({
	productImages: many(productImages),
	productGroup: one(productGroups, {
		fields: [products.productGroupId],
		references: [productGroups.id]
	}),
}));

export const productGroupsRelations = relations(productGroups, ({many}) => ({
	products: many(products),
	aiAgents: many(aiAgents),
}));

export const aiAgentsRelations = relations(aiAgents, ({one}) => ({
	systemUser: one(systemUsers, {
		fields: [aiAgents.createdBy],
		references: [systemUsers.id]
	}),
	productGroup: one(productGroups, {
		fields: [aiAgents.knowledgeSourceGroupId],
		references: [productGroups.id]
	}),
}));

export const systemUsersRelations = relations(systemUsers, ({many}) => ({
	aiAgents: many(aiAgents),
}));