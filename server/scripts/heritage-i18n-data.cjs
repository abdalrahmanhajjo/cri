'use strict';
/** Arabic + French copy for heritage taxonomy (part 1: categories + places 1–23). */
module.exports = {
  categories: {
    heritage_overview: {
      ar: {
        name: 'مقدمة طرابلس والتاريخ',
        description: 'مقدمة عن المدينة ورحلة في أعماق تاريخها.',
      },
      fr: {
        name: 'Tripoli — introduction et histoire',
        description: "Présentation de la ville et voyage dans son histoire.",
      },
    },
    castles_towers: {
      ar: { name: 'القلاع والأبراج', description: 'قلعة سان جيل وبرج برسباي وتحصينات أخرى.' },
      fr: { name: 'Citadelles et tours', description: 'Citadelle Saint-Gilles, tour de Barsbay et fortifications.' },
    },
    mosques: {
      ar: { name: 'المساجد والجوامع', description: 'مساجد تاريخية من العصر المملوكي والعثماني.' },
      fr: { name: 'Mosquées historiques', description: 'Mosquées mamloukes et ottomanes.' },
    },
    madrasas: {
      ar: { name: 'المدارس', description: 'مدارس دينية وقرآنية من العصر المملوكي.' },
      fr: { name: 'Madrasas', description: 'Écoles coraniques et collèges islamiques mamlouks.' },
    },
    khanqahs_takiyas: {
      ar: { name: 'التكايا والخانقاه', description: 'خانقاه وتكية مولوية ومسالك صوفية.' },
      fr: { name: 'Khanqahs et takiyas', description: 'Khanqah, takiya mawlawiya et voies soufies.' },
    },
    khans: {
      ar: { name: 'الخانات', description: 'خانات وأسواق مغطاة لإقامة التجار وتخزين البضائع.' },
      fr: { name: 'Khans', description: 'Caravansérails pour marchands et entrepôts.' },
    },
    hammams: {
      ar: { name: 'الحمامات', description: 'حمامات تقليدية مملوكية وعثمانية.' },
      fr: { name: 'Hammams', description: 'Bains publics mamlouks et ottomans.' },
    },
    old_markets: {
      ar: { name: 'أسواق طرابلس القديمة', description: 'شبكة الأسواق القديمة النشطة منذ قرون.' },
      fr: { name: 'Anciens souks de Tripoli', description: 'Réseau de souks actifs depuis des siècles.' },
    },
    churches: {
      ar: { name: 'الكنائس والمزارات', description: 'كنائس ومزارات مسيحية من العصر الصليبي إلى القرن التاسع عشر.' },
      fr: { name: 'Églises et sanctuaires', description: 'Lieux chrétiens des croisades au XIXe siècle.' },
    },
    modern_heritage: {
      ar: { name: 'معالم حديثة', description: 'محطة القطار، الساعة الحميدية، ساحة التل.' },
      fr: { name: 'Patrimoine moderne', description: 'Gare, horloge al-Hamidiya, place Al-Tal.' },
    },
    natural_urban: {
      ar: { name: 'مواقع كبرى وطبيعة', description: 'معرض رشيد كرامي، جزيرة النخيل، نهر أبو علي.' },
      fr: { name: 'Grands sites et nature', description: 'Foire Rachid Karami, réserve des îles, rivière Abou Ali.' },
    },
    living_heritage: {
      ar: { name: 'المطبخ والحرف', description: 'المطبخ الطرابلسي والحرف اليدوية التقليدية.' },
      fr: { name: 'Cuisine et artisanat', description: 'Cuisine tripolitaine et métiers traditionnels.' },
    },
  },
  places: {
    tripoli_introduction: {
      ar: {
        name: 'طرابلس — مقدمة',
        description:
          'تُعد طرابلس ثاني أكبر مدينة في لبنان وعاصمة الشمال، وتقع على بُعد 85 كيلومترًا شمال بيروت. إنها مدينة ودودة تتعايش فيها الحداثة مع التاريخ، ويجتمع فيها الاقتصاد المزدهر مع نمط الحياة الهادئ. تضم طرابلس العديد من المباني التاريخية والأثرية: المساجد، والمدارس، والخانات، والحمامات العامة، ومعظمها يعود إلى الحقبة المملوكية، وتحديدًا القرن الرابع عشر الميلادي. وتُشكّل الأسواق والخانات، التي تجمع الحرفيين من أصحاب المهن الواحدة — كصانعي الصابون، والصياغ، والعطّارين، والدبّاغين، والخياطين وغيرهم — أحياءً عمرانية متميزة لا تزال تحتفظ بالكثير من ملامح العصور الوسطى.',
        location: 'طرابلس، شمال لبنان',
        category: 'مقدمة طرابلس والتاريخ',
        duration: 'قراءة 15–30 دقيقة',
        price: '',
        bestTime: 'في أي وقت',
      },
      fr: {
        name: 'Tripoli — introduction',
        description:
          "Tripoli est la deuxième ville du Liban et la capitale du Nord, située à 85 kilomètres au nord de Beyrouth. C'est une ville accueillante où modernité et histoire coexistent. Tripoli abrite de nombreux bâtiments historiques : mosquées, écoles, khans et bains publics, dont la plupart datent de l'époque mamelouke, surtout du XIVe siècle. Les souks et khans regroupent les artisans d'un même métier — savonniers, orfèvres, parfumeurs, tanneurs, tailleurs — formant des quartiers qui conservent encore un fort caractère médiéval.",
        location: 'Tripoli, Liban-Nord',
        category: 'Tripoli — introduction et histoire',
        duration: 'Lecture 15–30 min',
        price: '',
        bestTime: 'À tout moment',
      },
    },
    tripoli_journey_history: {
      ar: {
        name: 'رحلة في عمق التاريخ',
        description:
          'على الرغم من قلة الاكتشافات الأثرية، فإن السجلات التاريخية تؤكد وجود طرابلس منذ القرن الرابع عشر قبل الميلاد. أنشأ الفينيقيون مركزًا تجاريًا على طرف شبه الجزيرة التي تحتضن اليوم مدينة الميناء؛ وفي الحقبة الفارسية تطوّر هذا المركز ليُصبح مركزًا فدراليًا. تمتعت طرابلس بموقع استراتيجي: بوابة الجنوب إلى سهل عكار، ميناءان طبيعيان، وجزر صغيرة تقيها من البحر. في العصر الهلنستي ظلّت محطة بحرية مهمة؛ مع الرومان بلغت المدينة ذروة مجدها بمبانٍ عامة ضخمة؛ وفي عام 551 ميلادية ضربها زلزال مدمر وتسونامي. بعد الفتح الإسلامي (بعد 635 م) أصبحت محطة للأسطول الأموي؛ في منتصف القرن الحادي عشر نالت درجة من الحكم الذاتي في عهد بني عمار الفاطمي وبرزت كمركز للعلم والثقافة؛ وفي 1109 تعرّضت لانتكاسة مع الحصار الصليبي. بعد الفتح الإسلامي أصبحت أيضًا مركزًا بحريًا وثقافيًا بارزًا في المنطقة.',
        location: 'نظرة تاريخية — طرابلس',
        category: 'مقدمة طرابلس والتاريخ',
        duration: 'قراءة 30–45 دقيقة',
        price: '',
        bestTime: 'في أي وقت',
      },
      fr: {
        name: 'Un voyage dans l’histoire',
        description:
          "Les sources confirment Tripoli dès le XIVe siècle av. J.-C. Les Phéniciens y fondèrent un comptoir sur la péninsule de El-Mina; à l'époque perse, il devint un pôle fédéral. La ville contrôlait routes commerciales et militaires entre mer et Homs. Sous les successeurs d'Alexandre elle resta une base navale; sous Rome elle connut son apogée (temples, stade). En 551 un tremblement de terre et un tsunami mirent fin à une longue prospérité byzantine. Après 635 elle servit la flotte omeyyade; au XIe siècle, sous les juges Banu Ammar fatimides, elle gagna en autonomie culturelle; en 1109 les Croisés prirent la ville. Elle demeura un centre maritime et culturel majeur.",
        location: 'Synthèse historique — Tripoli',
        category: 'Tripoli — introduction et histoire',
        duration: 'Lecture 30–45 min',
        price: '',
        bestTime: 'À tout moment',
      },
    },
    tripoli_citadel_saint_gilles: {
      ar: {
        name: 'قلعة طرابلس (سان جيل)',
        description:
          'تقع قلعة طرابلس على تلة أبي سمراء، المعروفة في الحقبة الصليبية باسم «تلة الحجاج». أُسِّست عام 645م على يد القائد العربي سفيان الأزدي، ثم أعاد الكونت ريمون دو سان جيل بناءها؛ أحرقها المماليك عام 1289م ثم أعاد الأمير أسندمر الكرجي تشييدها. يضمّ الحصن بابًا رئيسيًا في البرج الأول وبابين صغيرين؛ وفي الداخل مسارات إلى مستويات سُفلية استُخدمت كسجون ومخابئ أسلحة وسراديب تتصل بمنازل وأبراج ساحلية.',
        location: 'تلة أبي سمراء، طرابلس',
        category: 'القلاع والأبراج',
        duration: '1–2 ساعة',
        price: '',
        bestTime: 'صباحًا أو قبل الغروب',
      },
      fr: {
        name: 'Citadelle de Tripoli (Saint-Gilles)',
        description:
          "Sur la colline d'Abou Samra (« Tallat Al-Houjaj » à l'époque des croisés). Fondée en 645 par Soufyan al-Azadi, reconstruite par Raymond de Saint-Gilles, brûlée par les Mamelouks en 1289 puis relevée par l'émir Asandamir al-Korji. Grande porte dans la première tour, deux petites portes; escaliers vers des niveaux inférieurs (prisons, armureries, catacombes liées aux maisons et tours côtières).",
        location: 'Colline Abou Samra, Tripoli',
        category: 'Citadelles et tours',
        duration: '1–2 h',
        price: '',
        bestTime: 'Matin ou fin d’après-midi',
      },
    },
    barsbay_tower: {
      ar: {
        name: 'برج السباع (برسباي)',
        description:
          'شُيّد في منتصف القرن الرابع عشر على يد الأمير سيف الدين برسباي بن عبد الله بن حمزة الناصري. يُعدّ نموذجًا بارزًا لفن العمارة العسكرية المملوكية.',
        location: 'منطقة الميناء / الساحل، طرابلس',
        category: 'القلاع والأبراج',
        duration: '30–45 دقيقة',
        price: '',
        bestTime: 'نهارًا',
      },
      fr: {
        name: 'Tour de Barsbay (tour du Lion)',
        description:
          "Construite au milieu du XIVe siècle par l'émir Saif al-Din Barsabay ibn Abdullah al-Nasiri. Exemple remarquable de l'architecture militaire mamelouke.",
        location: 'Front de mer / port, Tripoli',
        category: 'Citadelles et tours',
        duration: '30–45 min',
        price: '',
        bestTime: 'En journée',
      },
    },
    great_mansouri_mosque: {
      ar: {
        name: 'الجامع المنصوري الكبير',
        description:
          'أقدم مساجد المدينة وأول مسجد يُشيّد في عهد المماليك. أُقيم عام 1294م على يد السلطان الأشرف خليل بن قلاوون فوق أنقاض كنيسة؛ وأضاف السلطان الناصر محمد بن قلاوون عام 1315م الأروقة الخارجية. المساحة نحو 3,224 م²؛ المئذنة أربع طبقات على الطراز اللومباردي الإيطالي وقد كانت برج جرس أُعيد استخدامه. المنبر الخشبي مزدان بزخارف هندسية دقيقة.',
        location: 'حي النوري — المدينة القديمة',
        category: 'المساجد والجوامع',
        duration: '45 دقيقة – ساعة',
        price: '',
        bestTime: 'بين أوقات الصلاة',
      },
      fr: {
        name: 'Grande mosquée al-Mansouri',
        description:
          "Plus ancienne mosquée de Tripoli et première des Mamelouks. Édifiée en 1294 par le sultan Ashraf Khalil ibn Qalawun sur une église; arcades de la cour ajoutées en 1315 par al-Nasser Muhammad. Environ 3 224 m²; minaret à quatre niveaux de style lombard (clocher réutilisé). Minbar en bois à motifs géométriques.",
        location: 'Quartier al-Nouri, vieille ville',
        category: 'Mosquées historiques',
        duration: '45 min – 1 h',
        price: '',
        bestTime: 'Entre les prières',
      },
    },
    sidi_abd_al_wahed_meknasi_mosque: {
      ar: {
        name: 'جامع سيدي عبد الواحد المكناسي',
        description:
          'أُنجز بناؤه عام 1306م على يد الشيخ عبد الواحد المكناسي من المغرب. من أقدم المساجد المملوكية؛ يتميّز بتأثير معماري مغربي ومئذنة صغيرة نسبيًا.',
        location: 'المدينة القديمة',
        category: 'المساجد والجوامع',
        duration: '20–30 دقيقة',
        price: '',
        bestTime: 'بين أوقات الصلاة',
      },
      fr: {
        name: 'Mosquée Sidi Abd al-Wahed al-Meknasi',
        description:
          "Construite en 1306 par le cheikh Abd Al-Wahed al-Meknasi, saint venu du Maroc. Parmi les plus anciennes mosquées mameloukes; style marocain et minaret modeste.",
        location: 'Vieille ville',
        category: 'Mosquées historiques',
        duration: '20–30 min',
        price: '',
        bestTime: 'Entre les prières',
      },
    },
    al_burtasi_mosque_madrasa: {
      ar: {
        name: 'جامع ومدرسة البرطاسي',
        description:
          'في القرن الرابع عشر شيّد عيسى بن عمر البرطاسي جامعًا ومدرسة فقهية شافعية على ضفاف نهر أبو علي. لفت أنظار الرحّالة الأوروبيين في القرن التاسع عشر. مئذنة على قوس وتأثيرات بيزنطية وفاطمية وأندلسية.',
        location: 'ضفة نهر أبو علي',
        category: 'المساجد والجوامع',
        duration: '30–45 دقيقة',
        price: '',
        bestTime: 'نهارًا',
      },
      fr: {
        name: 'Mosquée et madrasa al-Burtasi',
        description:
          "Au XIVe siècle, Issa ibn Omar al-Burtasi bâtit mosquée et école chaféite sur l'Abou Ali. Admirée des voyageurs européens au XIXe siècle. Minaret en arc; influences byzantine, fatimide et andalouse.",
        location: 'Rive de l’Abou Ali',
        category: 'Mosquées historiques',
        duration: '30–45 min',
        price: '',
        bestTime: 'En journée',
      },
    },
    al_tawba_mosque: {
      ar: {
        name: 'جامع التوبة',
        description:
          'في عهد السلطان الناصر قلاوون، القرن الرابع عشر. ارتبط برواية عن مهندس الجامع المنصوري وبناء هذا الجامع توبةً. على ضفاف أبو علي؛ لوحة برونزية توثق فيضان 1643م؛ مئذنة سداسية وقباب جميلة.',
        location: 'ضفة نهر أبو علي',
        category: 'المساجد والجوامع',
        duration: '30 دقيقة',
        price: '',
        bestTime: 'بين أوقات الصلاة',
      },
      fr: {
        name: 'Mosquée al-Tawba',
        description:
          "Sous al-Nasser Qalawun, XIVe siècle. Légende de l'architecte de la Grande Mosquée et expiation. Sur l'Abou Ali; plaque de bronze de l'inondation de 1643; minaret hexagonal et dômes élégants.",
        location: 'Rive de l’Abou Ali',
        category: 'Mosquées historiques',
        duration: '30 min',
        price: '',
        bestTime: 'Entre les prières',
      },
    },
    al_attar_mosque: {
      ar: {
        name: 'جامع العطار',
        description:
          'بُني عام 1334م على يد بدر الدين العطار فوق أنقاض كنيسة صليبية؛ شمال خان المصريين. مئذنة مربعة شاهقة تشبه البرج الحربي؛ ثلاثة أبواب بزخارف ونقوش.',
        location: 'المدينة القديمة',
        category: 'المساجد والجوامع',
        duration: '30–45 دقيقة',
        price: '',
        bestTime: 'بين أوقات الصلاة',
      },
      fr: {
        name: 'Mosquée al-Attar',
        description:
          "1334 par Badr al-Din al-Attar sur une église croisée; au nord du khan al-Masriyine. Minaret carré, très haut, de type tour militaire; trois portes ornées.",
        location: 'Vieille ville',
        category: 'Mosquées historiques',
        duration: '30–45 min',
        price: '',
        bestTime: 'Entre les prières',
      },
    },
    taynal_mosque: {
      ar: {
        name: 'جامع طينال',
        description:
          'خارج أسوار المدينة في باب الرمل؛ بأمر الأمير سيف الدين طينال الحاجب. هندسة دفاعية؛ ممرات سرية في الجدران؛ باحة رخام وقبة على أعمدة غرانيت؛ مئذنة بسلالم حجرية مزدوجة؛ محراب خشبي مميز.',
        location: 'باب الرمل',
        category: 'المساجد والجوامع',
        duration: '45 دقيقة – ساعة',
        price: '',
        bestTime: 'صباحًا',
      },
      fr: {
        name: 'Mosquée Taynal',
        description:
          "Hors les murs, Bab al-Raml, par l'émir Saif al-Din Taynal. Architecture défensive, passages secrets, cour en marbre, coupole sur colonnes de granit, minaret à doubles escaliers, beau mihrab en bois.",
        location: 'Bab al-Raml',
        category: 'Mosquées historiques',
        duration: '45 min – 1 h',
        price: '',
        bestTime: 'Matin',
      },
    },
    al_uwaysiya_mosque: {
      ar: {
        name: 'جامع الأويسية',
        description:
          'على الضفة الغربية لأبو علي؛ أصله زاوية مملوكية حوّلها العثمانيون إلى مسجد وأضافوا مئذنة عثمانية. تُعد قبته من أكبر قباب المساجد التاريخية في المدينة.',
        location: 'طلعة سوق السمك',
        category: 'المساجد والجوامع',
        duration: '30 دقيقة',
        price: '',
        bestTime: 'بين أوقات الصلاة',
      },
      fr: {
        name: 'Mosquée al-Uwaysiyat',
        description:
          "Rive ouest de l'Abou Ali. Petite zawiya mamelouke convertie en mosquée par les Ottomans avec minaret ottoman. Grand dôme parmi les mosquées historiques.",
        location: 'Vers le marché au poisson',
        category: 'Mosquées historiques',
        duration: '30 min',
        price: '',
        bestTime: 'Entre les prières',
      },
    },
    al_tahham_mosque: {
      ar: {
        name: 'جامع الطحّام',
        description:
          'في حي الحدادين فوق الحوانيت، يُصعد إليه بدرج. عهد مملوكي؛ الباني مجهول. مئذنة قصيرة بزخارف دقيقة؛ أعمدة غرانيت بتيجان كورنثية.',
        location: 'الحدادين',
        category: 'المساجد والجوامع',
        duration: '20–30 دقيقة',
        price: '',
        bestTime: 'بين أوقات الصلاة',
      },
      fr: {
        name: 'Mosquée al-Tahham',
        description:
          "Quartier Haddadine, au-dessus des boutiques, escalier d'accès. Époque mamelouke, bâtisseur inconnu. Minaret court mais riche décor; colonnes de granit à chapiteaux corinthiens.",
        location: 'Haddadine',
        category: 'Mosquées historiques',
        duration: '20–30 min',
        price: '',
        bestTime: 'Entre les prières',
      },
    },
    al_muallaq_mosque: {
      ar: {
        name: 'جامع المعلّق',
        description:
          'في الحدادين فوق قبوة ومخازن؛ بناه محمود لطفي الزعيم 1555م. يُعرف بالمحمودية. مئذنة ثمانية الأضلاع بأقواس وشرفات مزخرفة.',
        location: 'الحدادين',
        category: 'المساجد والجوامع',
        duration: '30–45 دقيقة',
        price: '',
        bestTime: 'بين أوقات الصلاة',
      },
      fr: {
        name: 'Mosquée al-Muallaq (suspendue)',
        description:
          "1555 par Mahmoud Lotfi al-Zaim, sur caves et magasins. Minaret octogonal à huit arêtes, arches et petits balcons fleuris. Aussi dite al-Mahmoudiya.",
        location: 'Haddadine',
        category: 'Mosquées historiques',
        duration: '30–45 min',
        price: '',
        bestTime: 'Entre les prières',
      },
    },
    al_hamdi_mosque: {
      ar: {
        name: 'جامع الحميدي',
        description:
          'سُمّي سابقًا جامع التفاحي أو جامع الدباغين؛ يُرجّح مطلع القرن السادس عشر. هُدم وأُعيد بناؤه 1892 في عهد عبد الحميد الثاني.',
        location: 'المدينة القديمة',
        category: 'المساجد والجوامع',
        duration: '20–30 دقيقة',
        price: '',
        bestTime: 'بين أوقات الصلاة',
      },
      fr: {
        name: 'Mosquée al-Hamdi',
        description:
          "Anciennement mosquée Tuffahi / des tanneurs; début XVIe siècle mamelouk. Détruite et reconstruite en 1892 sous Abdul Hamid II.",
        location: 'Vieille ville',
        category: 'Mosquées historiques',
        duration: '20–30 min',
        price: '',
        bestTime: 'Entre les prières',
      },
    },
    al_mashhad_madrasa: {
      ar: {
        name: 'المشهد (مدرسة)',
        description:
          'في حي النوري مقابل المدرسة الشمسية؛ سُميت لضريح داخلها. بوابة بفسيفساء ورخام أبيض وأخضر ومقرنصات مملوكية.',
        location: 'حي النوري',
        category: 'المدارس',
        duration: '30–45 دقيقة',
        price: '',
        bestTime: 'صباحًا',
      },
      fr: {
        name: 'Madrasa al-Mashhad',
        description:
          "Quartier al-Nouri, face à l'école solaire; nom lié au mausolée. Portail à mosaïques, marbre blanc et vert, muqarnas mamelouks.",
        location: 'Al-Nouri',
        category: 'Madrasas',
        duration: '30–45 min',
        price: '',
        bestTime: 'Matin',
      },
    },
    al_nouriya_madrasa: {
      ar: {
        name: 'المدرسة النورية',
        description:
          'اختلاف حول الباني: سنقر النوري ~1310 أو نور الدين وأثرياء المدينة؛ حمّام النوري مقابلها. مدخل بحجارة بيضاء وسوداء؛ محراب رخامي بفسيفساء من أجمل المحاريب في طرابلس.',
        location: 'حي النوري',
        category: 'المدارس',
        duration: '30–45 دقيقة',
        price: '',
        bestTime: 'صباحًا',
      },
      fr: {
        name: 'Madrasa al-Nouriya',
        description:
          "Attribution incertaine (Sanqar al-Nouri ~1310 ou Nour al-Din); hammam al-Nouri en face. Portail pierres noires et blanches; beau mihrab en marbre mosaïqué.",
        location: 'Al-Nouri',
        category: 'Madrasas',
        duration: '30–45 min',
        price: '',
        bestTime: 'Matin',
      },
    },
    al_qartawiya_madrasa: {
      ar: {
        name: 'المدرسة القرطاوية',
        description:
          'من أكبر مدارس المماليك؛ ضمن حلقة حول الجامع المنصوري. أمر ببنائها قرطاي 1316–1326. الجدار الخلفي بآيات وزخارف لنشر المراسيم؛ بوابة ضخمة بمقرنصات.',
        location: 'جوار الجامع المنصوري',
        category: 'المدارس',
        duration: '30–45 دقيقة',
        price: '',
        bestTime: 'صباحًا',
      },
      fr: {
        name: 'Madrasa al-Qartawiyat',
        description:
          "Grande école mamelouke autour de la Grande Mosquée, commandée par Qurtay (1316-1326). Mur arrière avec versets pour affichage des décrets; portail monumental à muqarnas.",
        location: 'Près de la Grande Mosquée',
        category: 'Madrasas',
        duration: '30–45 min',
        price: '',
        bestTime: 'Matin',
      },
    },
    al_qadiriya_madrasa: {
      ar: {
        name: 'المدرسة القادرية',
        description:
          'من أكبر المدارس بعد القرطاوية؛ القرن الرابع عشر. حُوّلت مؤخرًا إلى مسجد. بوابة بلا زخارف؛ ضريح مجهول الهوية.',
        location: 'المدينة القديمة',
        category: 'المدارس',
        duration: '30–45 دقيقة',
        price: '',
        bestTime: 'صباحًا',
      },
      fr: {
        name: 'Madrasa al-Qadiriya',
        description:
          "Grande école après Qartawiyat, XIVe siècle; récemment convertie en mosquée. Portail sobre; mausolée au saint inconnu.",
        location: 'Vieille ville',
        category: 'Madrasas',
        duration: '30–45 min',
        price: '',
        bestTime: 'Matin',
      },
    },
    al_nasiriya_madrasa: {
      ar: {
        name: 'المدرسة الناصرية',
        description:
          'منتصف القرن الرابع عشر؛ السلطان حسن بن محمد بن قلاوون (الناصر). إلى يسار الطريق للجامع المنصوري؛ نقش «عزّ لمولانا السلطان ناصر».',
        location: 'جوار الجامع المنصوري',
        category: 'المدارس',
        duration: '30–45 دقيقة',
        price: '',
        bestTime: 'صباحًا',
      },
      fr: {
        name: 'Madrasa al-Nasiriya',
        description:
          "Milieu du XIVe siècle par le sultan Hassan al-Nasir. À gauche vers la Grande Mosquée; inscription « Gloire à notre sultan Nasir ».",
        location: 'Près de la Grande Mosquée',
        category: 'Madrasas',
        duration: '30–45 min',
        price: '',
        bestTime: 'Matin',
      },
    },
    al_saqraqiya_madrasa: {
      ar: {
        name: 'المدرسة السقرقية',
        description:
          'أنشأها سيف الدين أقرق في النصف الأول من القرن الرابع عشر. واجهة بنقوش توثق التأسيس والأوقاف.',
        location: 'المدينة القديمة',
        category: 'المدارس',
        duration: '30–45 دقيقة',
        price: '',
        bestTime: 'صباحًا',
      },
      fr: {
        name: 'Madrasa al-Saqraqiyat',
        description:
          "Première moitié du XIVe siècle par Saif al-Din Aqraq. Façade avec inscriptions sur la fondation et les biens fondés.",
        location: 'Vieille ville',
        category: 'Madrasas',
        duration: '30–45 min',
        price: '',
        bestTime: 'Matin',
      },
    },
    al_khatouniya_madrasa: {
      ar: {
        name: 'المدرسة الخاتونية',
        description:
          '1374م؛ الأمير عز الدين إيدمر الأشرفي وزوجته أرغون خاتون. في الحدادين مقابل السقرقية؛ نقش الوقف وشعار الأمير.',
        location: 'صف البلاط، الحدادين',
        category: 'المدارس',
        duration: '30–45 دقيقة',
        price: '',
        bestTime: 'صباحًا',
      },
      fr: {
        name: 'Madrasa al-Khatouniya',
        description:
          "1374 par Izz Ed-Dine Idmer al-Ashrafi et Arghun Khatoun. Haddadine, face à Saqraqiya; inscription de waqf et armoiries.",
        location: 'Haddadine',
        category: 'Madrasas',
        duration: '30–45 min',
        price: '',
        bestTime: 'Matin',
      },
    },
    al_khanqah_tripoli: {
      ar: {
        name: 'الخانقاه',
        description:
          '1467م في الحدادين؛ عهد قايناي المؤيدي. نُسبت للست صالحة. آوى متصوفين ومحاربين وزوارًا. بوابة كبيرة، ممر ضيق، فناء ببركة.',
        location: 'الحدادين',
        category: 'التكايا والخانقاه',
        duration: '30 دقيقة',
        price: '',
        bestTime: 'حسب التنسيق',
      },
      fr: {
        name: 'Khanqah',
        description:
          "1467 à Haddadine sous Qaynay al-Mu'ayyadi; liée à Sitt Salha. Accueillait soufis, guerriers et hôtes. Grande porte, couloir, cour avec bassin.",
        location: 'Haddadine',
        category: 'Khanqahs et takiyas',
        duration: '30 min',
        price: '',
        bestTime: 'Sur rendez-vous',
      },
    },
    takiya_al_mawlawiya: {
      ar: {
        name: 'التكية المولوية',
        description:
          '1619م؛ صامصونجي علي. من تكايا المولوية خارج تركيا (القاهرة، القدس، دمشق، حلب، البوسنة، قبرص). مركز للطريقة الرومية حتى منتصف القرن العشرين.',
        location: 'طرابلس',
        category: 'التكايا والخانقاه',
        duration: '30–45 دقيقة',
        price: '',
        bestTime: 'حسب الزيارة',
      },
      fr: {
        name: 'Takiya al-Mawlawiya',
        description:
          "1619 par Samsunji Ali. Takiya mawlawiya ottomane (Caire, Jérusalem, Damas, Alep, Bosnie, Chypre). Centre de l'ordre de Jalaluddin Rumi jusqu'au milieu du XXe siècle.",
        location: 'Tripoli',
        category: 'Khanqahs et takiyas',
        duration: '30–45 min',
        price: '',
        bestTime: 'Selon accès',
      },
    },
  },
};
