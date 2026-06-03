"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const prismaClient_1 = __importDefault(require("./prismaClient"));
const uploads_1 = require("./uploads");
const router = (0, express_1.Router)();
// Multer setup for local uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploads_1.uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path_1.default.extname(file.originalname));
    },
});
const upload = (0, multer_1.default)({ storage });
// Helper to construct full image URL
const getImageUrl = (req, filename) => {
    return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
};
// --- CATEGORIES ---
router.get('/categories', async (req, res) => {
    try {
        const categories = await prismaClient_1.default.category.findMany({
            include: { _count: { select: { products: true } } },
        });
        res.json(categories);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});
router.post('/categories', upload.single('image'), async (req, res) => {
    try {
        const { name } = req.body;
        let imageUrl = null;
        if (req.file) {
            imageUrl = getImageUrl(req, req.file.filename);
        }
        const category = await prismaClient_1.default.category.create({
            data: { name, imageUrl },
        });
        res.json(category);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create category' });
    }
});
router.delete('/categories/:id', async (req, res) => {
    try {
        await prismaClient_1.default.category.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete category' });
    }
});
// --- PRODUCTS ---
router.get('/products', async (req, res) => {
    try {
        const { isSignature, categoryId } = req.query;
        const filter = {};
        if (isSignature === 'true')
            filter.isSignature = true;
        if (categoryId)
            filter.categoryId = String(categoryId);
        const products = await prismaClient_1.default.product.findMany({
            where: filter,
            include: {
                category: true,
                images: true,
                variations: true,
            },
        });
        res.json(products);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});
router.get('/products/:id', async (req, res) => {
    try {
        const product = await prismaClient_1.default.product.findUnique({
            where: { id: req.params.id },
            include: { images: true, variations: true, category: true },
        });
        if (!product)
            return res.status(404).json({ error: 'Product not found' });
        res.json(product);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});
router.post('/products', upload.any(), async (req, res) => {
    try {
        const { name, shortDescription, description, price, isSignature, categoryId, variations } = req.body;
        const files = (req.files ?? []);
        const mainImage = files.find((file) => file.fieldname === 'mainImage');
        const secondaryImages = files.filter((file) => file.fieldname === 'secondaryImages');
        if (!mainImage) {
            return res.status(400).json({ error: 'Main image is required' });
        }
        const mainImageUrl = getImageUrl(req, mainImage.filename);
        // Create product
        const product = await prismaClient_1.default.product.create({
            data: {
                name,
                shortDescription,
                description,
                price: parseFloat(price),
                isSignature: isSignature === 'true',
                categoryId: categoryId || null,
                mainImage: mainImageUrl,
            },
        });
        // Handle secondary images
        if (secondaryImages.length > 0) {
            const imageCreates = secondaryImages.map((file) => ({
                url: getImageUrl(req, file.filename),
                productId: product.id,
            }));
            await prismaClient_1.default.productImage.createMany({ data: imageCreates });
        }
        if (variations) {
            const parsedVars = JSON.parse(variations);
            const varCreates = parsedVars.map((v) => ({
                name: v.name,
                value: v.value,
                priceAdded: parseFloat(v.priceAdded || 0),
                imageUrl: (() => {
                    const variationImage = v.imageField
                        ? files.find((file) => file.fieldname === v.imageField)
                        : null;
                    return variationImage ? getImageUrl(req, variationImage.filename) : null;
                })(),
                productId: product.id,
            }));
            if (varCreates.length > 0) {
                await prismaClient_1.default.productVariation.createMany({ data: varCreates });
            }
        }
        res.json(product);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});
router.delete('/products/:id', async (req, res) => {
    try {
        await prismaClient_1.default.product.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete product' });
    }
});
// --- ORDERS ---
router.post('/orders', async (req, res) => {
    try {
        const { guestDeviceId, customerName, customerEmail, customerPhone, shippingAddress, items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Order must contain at least one item' });
        }
        let totalAmount = 0;
        const orderItemsData = await Promise.all(items.map(async (item) => {
            const quantity = Number(item.quantity);
            if (!item.productId || !Number.isInteger(quantity) || quantity < 1) {
                throw new Error('Invalid order item');
            }
            const product = await prismaClient_1.default.product.findUnique({
                where: { id: item.productId },
                include: { variations: true },
            });
            if (!product) {
                throw new Error('Product not found');
            }
            const variation = item.variationId
                ? product.variations.find((entry) => entry.id === item.variationId)
                : null;
            if (item.variationId && !variation) {
                throw new Error('Product variation not found');
            }
            const priceAtOrder = product.price + (variation?.priceAdded ?? 0);
            totalAmount += priceAtOrder * quantity;
            return {
                productId: item.productId,
                variationId: item.variationId || null,
                quantity,
                priceAtOrder,
            };
        }));
        const order = await prismaClient_1.default.order.create({
            data: {
                guestDeviceId,
                customerName,
                customerEmail,
                customerPhone,
                shippingAddress,
                totalAmount,
                items: {
                    create: orderItemsData,
                },
            },
            include: { items: true },
        });
        res.json(order);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create order';
        res.status(500).json({ error: message });
    }
});
router.get('/orders', async (req, res) => {
    try {
        const { guestDeviceId } = req.query;
        const filter = {};
        if (guestDeviceId)
            filter.guestDeviceId = String(guestDeviceId);
        const orders = await prismaClient_1.default.order.findMany({
            where: filter,
            include: {
                items: {
                    include: { product: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(orders);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});
router.put('/orders/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const order = await prismaClient_1.default.order.update({
            where: { id: req.params.id },
            data: { status },
        });
        res.json(order);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update order status' });
    }
});
exports.default = router;
