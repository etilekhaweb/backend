import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import prisma from './prismaClient';
import { uploadsDir } from './uploads';
import supabase from './supabaseClient';

const router = Router();

// Multer setup for local uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Helper to construct full image URL
const getImageUrl = (req: any, filename: string) => {
  return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
};

// --- CATEGORIES ---

// Supabase fallback routes (use SUPABASE_URL + SUPABASE_ANON_KEY in .env)
router.get('/sb/categories', async (req, res) => {
  try {
    const { data, error } = await supabase.from('category').select('*');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Supabase categories error', err);
    res.status(500).json({ error: 'Failed to fetch categories (supabase)' });
  }
});

// Create category via Supabase using JSON body { name, image_url }
router.post('/sb/categories', async (req, res) => {
  try {
    const { name, image_url } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const { data, error } = await supabase.from('category').insert([{ name, image_url }]).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Supabase create category error', err);
    res.status(500).json({ error: 'Failed to create category (supabase)' });
  }
});

router.get('/sb/products', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('product')
      .select('*, product_image(*), product_variation(*), category(*)');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Supabase products error', err);
    res.status(500).json({ error: 'Failed to fetch products (supabase)' });
  }
});

// Get single product via Supabase
router.get('/sb/products/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { data, error } = await supabase
      .from('product')
      .select('*, product_image(*), product_variation(*), category(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Supabase product detail error', err);
    res.status(500).json({ error: 'Failed to fetch product (supabase)' });
  }
});

router.get('/sb/orders', async (req, res) => {
  try {
    const { data, error } = await supabase.from('order').select('*, order_item(*)');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Supabase orders error', err);
    res.status(500).json({ error: 'Failed to fetch orders (supabase)' });
  }
});

// Create product via Supabase (expects JSON)
router.post('/sb/products', async (req, res) => {
  try {
    const {
      name,
      short_description,
      description,
      price,
      is_signature,
      category_id,
      main_image,
      images,
      variations,
      stock,
      metadata,
    } = req.body;

    const { data: prod, error: prodErr } = await supabase
      .from('product')
      .insert([
        {
          name,
          short_description,
          description,
          price,
          is_signature,
          category_id,
          main_image,
          stock: stock ?? 0,
          metadata: metadata ?? {},
        },
      ])
      .select()
      .single();
    if (prodErr) throw prodErr;

    // insert images
    if (Array.isArray(images) && images.length > 0) {
      const imgRows = images.map((url: string) => ({ url, product_id: prod.id }));
      const { error: imgErr } = await supabase.from('product_image').insert(imgRows);
      if (imgErr) console.error('product_image insert error', imgErr);
    }

    // insert variations
    if (Array.isArray(variations) && variations.length > 0) {
      const varRows = variations.map((v: any) => ({
        name: v.name,
        value: v.value,
        price_added: v.priceAdded ?? v.price_added ?? 0,
        image_url: v.imageUrl ?? v.image_url ?? null,
        product_id: prod.id,
      }));
      const { error: varErr } = await supabase.from('product_variation').insert(varRows);
      if (varErr) console.error('product_variation insert error', varErr);
    }

    res.json(prod);
  } catch (err) {
    console.error('Supabase create product error', err);
    res.status(500).json({ error: 'Failed to create product (supabase)' });
  }
});

// Delete product via Supabase
router.delete('/sb/products/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { error } = await supabase.from('product').delete().match({ id });
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Supabase delete product error', err);
    res.status(500).json({ error: 'Failed to delete product (supabase)' });
  }
});

// Create order via Supabase
router.post('/sb/orders', async (req, res) => {
  try {
    const { guestDeviceId, customerName, customerEmail, customerPhone, shippingAddress, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Order must contain items' });

    // calculate totals
    let subtotal = 0;
    const orderItems = items.map((it: any) => {
      const qty = Number(it.quantity);
      const unit = Number(it.priceAtOrder ?? it.unit_price ?? 0);
      subtotal += qty * unit;
      return { product_id: it.productId, variation_id: it.variationId ?? null, quantity: qty, unit_price: unit };
    });

    const shipping = 0;
    const tax = 0;
    const total = subtotal + shipping + tax;

    const { data: order, error: orderErr } = await supabase
      .from('order')
      .insert([
        {
          guest_device_id: guestDeviceId || null,
          customer_name: customerName,
          customer_email: customerEmail || null,
          customer_phone: customerPhone,
          shipping_address: shippingAddress,
          subtotal,
          shipping,
          tax,
          total,
          status: 'PENDING',
          meta: {},
        },
      ])
      .select()
      .single();
    if (orderErr) throw orderErr;

    // insert order items
    const itemsRows = orderItems.map((it: any) => ({ ...it, order_id: order.id }));
    const { error: itemsErr } = await supabase.from('order_item').insert(itemsRows);
    if (itemsErr) console.error('order_item insert error', itemsErr);

    // return order with items
    const { data: fullOrder, error: fullErr } = await supabase.from('order').select('*, order_item(*)').eq('id', order.id).single();
    if (fullErr) throw fullErr;
    res.json(fullOrder);
  } catch (err) {
    console.error('Supabase create order error', err);
    res.status(500).json({ error: 'Failed to create order (supabase)' });
  }
});

// Delete category via Supabase
router.delete('/sb/categories/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { error } = await supabase.from('category').delete().match({ id });
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Supabase delete category error', err);
    res.status(500).json({ error: 'Failed to delete category (supabase)' });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
    });
    res.json(categories);
  } catch (error) {
    console.error(error);
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
    const category = await prisma.category.create({ data: { name, imageUrl } });
    res.json(category);
  } catch (error) {
    console.error('Prisma create category error', error);
    // Fallback: if Prisma reports missing table, insert directly into Supabase
    // so admin can continue creating categories while Prisma schema is fixed.
    try {
      const { name } = req.body;
      const imageUrl = req.file ? getImageUrl(req, req.file.filename) : null;
      const { data, error } = await supabase.from('category').insert([{ name, image_url: imageUrl }]).select().single();
      if (error) throw error;
      return res.json(data);
    } catch (sbErr) {
      console.error('Supabase fallback create category error', sbErr);
      return res.status(500).json({ error: 'Failed to create category' });
    }
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// --- PRODUCTS ---

router.get('/products', async (req, res) => {
  try {
    const { isSignature, categoryId } = req.query;
    const filter: any = {};
    if (isSignature === 'true') filter.isSignature = true;
    if (categoryId) filter.categoryId = String(categoryId);

    const products = await prisma.product.findMany({
      where: filter,
      include: {
        category: true,
        images: true,
        variations: true,
      },
    });
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.get('/products/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { images: true, variations: true, category: true },
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

router.post('/products', upload.any(), async (req: any, res) => {
  try {
    const { name, shortDescription, description, price, isSignature, categoryId, variations } = req.body;
    const files = (req.files ?? []) as Express.Multer.File[];
    const mainImage = files.find((file) => file.fieldname === 'mainImage');
    const secondaryImages = files.filter((file) => file.fieldname === 'secondaryImages');
    
    if (!mainImage) {
      return res.status(400).json({ error: 'Main image is required' });
    }

    const mainImageUrl = getImageUrl(req, mainImage.filename);
    
    // Create product
    const product = await prisma.product.create({
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
      const imageCreates = secondaryImages.map((file: any) => ({
        url: getImageUrl(req, file.filename),
        productId: product.id,
      }));
      await prisma.productImage.createMany({ data: imageCreates });
    }

    if (variations) {
      const parsedVars = JSON.parse(variations);
      const varCreates = parsedVars.map((v: any) => ({
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
        await prisma.productVariation.createMany({ data: varCreates });
      }
    }

    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
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
    const orderItemsData = await Promise.all(items.map(async (item: any) => {
      const quantity = Number(item.quantity);
      if (!item.productId || !Number.isInteger(quantity) || quantity < 1) {
        throw new Error('Invalid order item');
      }

      const product = await prisma.product.findUnique({
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

    const order = await prisma.order.create({
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create order';
    console.error(error);
    res.status(500).json({ error: message });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const { guestDeviceId } = req.query;
    const filter: any = {};
    if (guestDeviceId) filter.guestDeviceId = String(guestDeviceId);

    const orders = await prisma.order.findMany({
      where: filter,
      include: {
        items: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.put('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

export default router;
