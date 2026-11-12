/**
 * კატეგორიების სია.
 *
 * ახალი კატეგორიის დასამატებლად ქვემოთ სიაში ჩაამატეთ ერთი ხაზი:
 *   { id: 'river', name: 'მდინარე', icon: '🏞️' },
 *
 * - id    — უნიკალური ლათინური სახელი (ჰარების გარეშე)
 * - name  — რაც მოთამაშეებს გამოუჩნდებათ
 * - icon  — ემოჯი
 * - allowLatin: true — თუ ამ კატეგორიაში ლათინური პასუხიც მისაღებია (მაგ. ბრენდი)
 */
export interface Category {
  id: string;
  name: string;
  icon: string;
  allowLatin?: boolean;
  custom?: boolean;
}

export const CATEGORIES: Category[] = [
  { id: 'country', name: 'ქვეყანა', icon: '🌍' },
  { id: 'city', name: 'ქალაქი', icon: '🏙️' },
  { id: 'animal', name: 'ცხოველი', icon: '🦊' },
  { id: 'plant', name: 'მცენარე', icon: '🌿' },
  { id: 'brand', name: 'ბრენდი', icon: '🏷️', allowLatin: true },
  { id: 'dish', name: 'კერძი', icon: '🍲' },
];

/** ჰოსტის მიერ ოთახში დამატებული კატეგორიის იკონი */
export const CUSTOM_CATEGORY_ICON = '⭐';
