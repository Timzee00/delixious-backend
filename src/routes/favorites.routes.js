import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listFavoriteRestaurants, addFavoriteRestaurant, removeFavoriteRestaurant, listFavoriteDishes, saveFavoriteDish, removeFavoriteDish } from '../controllers/favorites.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/restaurants', listFavoriteRestaurants);
router.get('/dishes', listFavoriteDishes);
router.post('/dishes/:menuItemId', saveFavoriteDish);
router.delete('/dishes/:menuItemId', removeFavoriteDish);
router.post('/restaurants/:restaurantId', addFavoriteRestaurant);
router.delete('/restaurants/:restaurantId', removeFavoriteRestaurant);

export default router;
