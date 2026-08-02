import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DogBreedWikiDoc } from '../schemas/dogs_wiki.model';
import { getCloudinaryUrl } from '../../../common/utils/media.util';

export interface QueryOptions {
  page: number;
  limit: number;
  search?: string;
  group?: string;
  energy_level?: number;
  trainability?: number;
  shedding_level?: number;
  suitable_for?: string;
  lang?: 'vi' | 'en';
  sort?: string;
  ids?: string[];
  excludeIds?: string[];
}

@Injectable()
export class DogsWikiService {
  constructor(
    @InjectModel('DogBreedWikiEn')
    private dogBreedWikiEnModel: Model<DogBreedWikiDoc>,
    @InjectModel('DogBreedWikiVi')
    private dogBreedWikiViModel: Model<DogBreedWikiDoc>,
  ) {}

  private getModel(lang: 'vi' | 'en' = 'en') {
    return lang === 'vi' ? this.dogBreedWikiViModel : this.dogBreedWikiEnModel;
  }

  async createBreed(
    data: Partial<DogBreedWikiDoc>,
    lang: 'vi' | 'en' = 'en',
  ): Promise<DogBreedWikiDoc> {
    const Model = this.getModel(lang);
    if (!data.slug || !data.breed) {
      throw new Error('Slug and Breed Name are required.');
    }
    const existing = await Model.findOne({
      $or: [{ slug: data.slug }, { breed: data.breed }],
    });
    if (existing) {
      throw new ConflictException('Slug or Breed Name already exists.');
    }
    return Model.create(data);
  }

  async getBreedBySlug(
    slug: string,
    lang: 'vi' | 'en' = 'en',
  ): Promise<DogBreedWikiDoc> {
    const Model = this.getModel(lang);
    const breed = await Model.findOne({
      slug: { $regex: new RegExp(`^${slug}$`, 'i') },
      isDeleted: false,
    }).lean();
    if (!breed)
      throw new NotFoundException(`Breed not found with slug: '${slug}'`);

    if (breed.mediaPath) {
      const url = getCloudinaryUrl(breed.mediaPath);
      (breed as any).mediaUrl = url;
      (breed as any).mediaPath = url;
    }
    return breed as any;
  }

  async getBreedsBySlugs(
    slugs: string[],
    lang: 'vi' | 'en' = 'en',
  ): Promise<DogBreedWikiDoc[]> {
    const Model = this.getModel(lang);
    if (!slugs || slugs.length === 0) {
      return [];
    }
    const breeds = await Model.find({
      slug: { $in: slugs },
      isDeleted: false,
    }).lean();

    return breeds.map((b: any) => {
      if (b.mediaPath) {
        const url = getCloudinaryUrl(b.mediaPath);
        b.mediaUrl = url;
        b.mediaPath = url;
      }
      return b;
    }) as any;
  }

  async getAllBreeds(options: QueryOptions) {
    const {
      page = 1,
      limit: rawLimit = 200,
      search,
      group,
      energy_level,
      trainability,
      shedding_level,
      suitable_for,
      ids,
      excludeIds,
      lang = 'en',
    } = options;
    const limit = Math.min(rawLimit, 500); // max 500 per request
    const Model = this.getModel(lang);
    const skip = (page - 1) * limit;

    const allowedSortFields = [
      'breed',
      'energy_level',
      'trainability',
      'shedding_level',
      'maintenance_difficulty',
      'rarity_level',
    ];
    let sortOption: { [key: string]: 1 | -1 } = { breed: 1 };

    if (options.sort) {
      const [field, direction] = options.sort.split('-');
      if (field === 'name' && allowedSortFields.includes('breed')) {
        sortOption = { breed: direction === 'desc' ? -1 : 1 };
      } else if (allowedSortFields.includes(field)) {
        sortOption = { [field]: direction === 'desc' ? -1 : 1 };
      }
    }

    const query: any = { isDeleted: { $ne: true } };

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      query.$or = [{ breed: searchRegex }, { slug: searchRegex }];
    }
    if (group) query.group = group;
    if (energy_level) query.energy_level = energy_level;
    if (trainability) query.trainability = trainability;
    if (shedding_level) query.shedding_level = shedding_level;
    if (suitable_for) query.suitable_for = suitable_for;
    if (ids) {
      query._id = { $in: ids };
    } else if (excludeIds) {
      query._id = { $nin: excludeIds };
    }

    const [breeds, total] = await Promise.all([
      Model.find(query)
        .select(
          'slug breed pokedexNumber group origin mediaPath rarity_level description',
        )
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),
      Model.countDocuments(query),
    ]);

    const formattedBreeds = breeds.map((b: any) => {
      if (b.mediaPath) {
        const url = getCloudinaryUrl(b.mediaPath);
        b.mediaUrl = url;
        b.mediaPath = url;
      }
      return b;
    });

    return {
      data: formattedBreeds,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getTotalBreedsCount(lang: 'vi' | 'en' = 'en'): Promise<number> {
    const Model = this.getModel(lang);
    return Model.countDocuments({ isDeleted: { $ne: true } });
  }

  async updateBreed(
    slug: string,
    data: Partial<DogBreedWikiDoc>,
    lang: 'vi' | 'en' = 'en',
  ): Promise<DogBreedWikiDoc> {
    const Model = this.getModel(lang);
    const breed = await Model.findOneAndUpdate(
      { slug, isDeleted: { $ne: true } },
      data,
      { new: true, runValidators: true },
    );
    if (!breed)
      throw new NotFoundException(
        `Breed not found with slug: '${slug}' to update.`,
      );
    return breed;
  }

  async softDeleteBreed(
    slug: string,
    lang: 'vi' | 'en' = 'en',
  ): Promise<{ message: string }> {
    const Model = this.getModel(lang);
    const result = await Model.updateOne(
      { slug, isDeleted: { $ne: true } },
      { isDeleted: true },
    );
    if (result.modifiedCount === 0) {
      throw new NotFoundException(
        `Breed not found with slug: ${slug} to delete.`,
      );
    }
    return { message: 'Breed soft deleted successfully.' };
  }
}
