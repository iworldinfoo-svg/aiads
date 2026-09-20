'use strict';
// Single source of truth for the 11-step wizard.
// Each field carries bilingual {ta,en} labels. `showIf` drives conditional
// questions. The client renders forms from this config; the server uses the
// same keys when building the master prompt / credits / continuity.

const CATEGORIES = [
  { value: 'real_estate', label: { ta: 'ரியல் எஸ்டேட்', en: 'Real estate' } },
  { value: 'jewellery', label: { ta: 'நகை', en: 'Jewellery' } },
  { value: 'textile', label: { ta: 'டெக்ஸ்டைல்', en: 'Textile' } },
  { value: 'restaurant', label: { ta: 'ரெஸ்டாரண்ட்', en: 'Restaurant' } },
  { value: 'salon', label: { ta: 'சலூன்', en: 'Salon' } },
  { value: 'clinic', label: { ta: 'கிளினிக்', en: 'Clinic' } },
  { value: 'education', label: { ta: 'கல்வி', en: 'Education' } },
  { value: 'other', label: { ta: 'மற்றவை', en: 'Other' } },
];

const SUBTYPES = {
  real_estate: [
    { value: 'plot', label: { ta: 'மனை / பிளாட்', en: 'Plot' } },
    { value: 'apartment', label: { ta: 'அபார்ட்மென்ட்', en: 'Apartment' } },
    { value: 'villa', label: { ta: 'வில்லா', en: 'Villa' } },
    { value: 'commercial', label: { ta: 'வணிக இடம்', en: 'Commercial' } },
    { value: 'venture', label: { ta: 'வென்ச்சர்', en: 'Venture' } },
  ],
  jewellery: [
    { value: 'gold', label: { ta: 'தங்க நகை', en: 'Gold' } },
    { value: 'diamond', label: { ta: 'டயமண்ட்', en: 'Diamond' } },
    { value: 'silver', label: { ta: 'வெள்ளி', en: 'Silver' } },
    { value: 'imitation', label: { ta: 'இமிடேஷன்', en: 'Imitation' } },
  ],
  textile: [
    { value: 'saree', label: { ta: 'புடவை', en: 'Saree' } },
    { value: 'shirt', label: { ta: 'சட்டை', en: 'Shirt' } },
    { value: 'kurti', label: { ta: 'குர்த்தா', en: 'Kurti' } },
  ],
  restaurant: [
    { value: 'veg', label: { ta: 'சைவ', en: 'Veg' } },
    { value: 'nonveg', label: { ta: 'அசைவ', en: 'Non-veg' } },
    { value: 'bakery', label: { ta: 'பேகரி', en: 'Bakery' } },
    { value: 'cafe', label: { ta: 'கஃபி', en: 'Cafe' } },
  ],
  salon: [
    { value: 'hair', label: { ta: 'முடி', en: 'Hair' } },
    { value: 'bridal', label: { ta: 'மணப்பெண்', en: 'Bridal' } },
    { value: 'spa', label: { ta: 'ஸ்பா', en: 'Spa' } },
  ],
  clinic: [
    { value: 'dental', label: { ta: 'பல்', en: 'Dental' } },
    { value: 'skin', label: { ta: 'சருமம்', en: 'Skin' } },
    { value: 'general', label: { ta: 'ஜெனரல்', en: 'General' } },
  ],
  education: [
    { value: 'school', label: { ta: 'பள்ளி', en: 'School' } },
    { value: 'coaching', label: { ta: 'கோச்சிங்', en: 'Coaching' } },
    { value: 'college', label: { ta: 'கல்லூரி', en: 'College' } },
  ],
  other: [{ value: 'other', label: { ta: 'மற்றவை', en: 'Other' } }],
};

const STYLE_PREVIEWS = {
  animation: { ta: 'அனிமேஷன்', en: 'Animation', emoji: '🎨' },
  cgi_vfx: { ta: 'CGI / VFX', en: 'CGI / VFX', emoji: '✨' },
  character_speaking: { ta: 'கேரக்டர் பேசும்', en: 'Character speaking', emoji: '🗣️' },
  live_action: { ta: 'லைவ் ஆக்ஷன்', en: 'Live-action look', emoji: '🎬' },
  product_showcase: { ta: 'ப்ராடக்ட் ஷோகேஸ்', en: 'Product showcase', emoji: '📦' },
  short_story: { ta: 'குறும்படம்', en: 'Short story', emoji: '📖' },
};

function opt(value, ta, en) {
  return { value, label: { ta, en } };
}

const steps = [
  {
    id: 1,
    title: { ta: 'தொழில் & கான்செப்ட்', en: 'Business & concept' },
    fields: [
      { key: 'category', label: { ta: 'வகை', en: 'Category' }, type: 'select', options: CATEGORIES, required: true },
      { key: 'business_name', label: { ta: 'வணிகப் பெயர்', en: 'Business name' }, type: 'text', required: true, placeholder: { ta: 'உதா: ஸ்ரீ லட்சுமி ஜுவல்லர்ஸ்', en: 'e.g. Sri Lakshmi Jewellers' } },
      { key: 'sub_type', label: { ta: 'துணை வகை', en: 'Sub-type' }, type: 'subtype', dependsOn: 'category', placeholder: { ta: 'தேர்ந்தெடுக்கவும்', en: 'Select' } },
      { key: 'ad_concept', label: { ta: 'விளம்பர கான்செப்ட் (தமிழில்)', en: 'Ad concept (plain Tamil)' }, type: 'textarea', placeholder: { ta: 'உங்கள் விளம்பர யோசனையை தமிழில் எழுதவும்', en: 'Describe your ad idea in Tamil' }, required: true },
      { key: 'offer', label: { ta: 'சலுகை / ஹைலைட்', en: 'Offer / highlight' }, type: 'text', placeholder: { ta: 'உதா: 25% தள்ளுபடி', en: 'e.g. 25% off' } },
      { key: 'goal', label: { ta: 'இலக்கு', en: 'Goal' }, type: 'select', options: [
        opt('calls', 'கால்', 'Calls'),
        opt('whatsapp', 'வாட்ஸ்அப்', 'WhatsApp'),
        opt('store_visit', 'கடை வருகை', 'Store visit'),
        opt('online_order', 'ஆன்லைன் ஆர்டர்', 'Online order'),
        opt('awareness', 'விழிப்புணர்வு', 'Awareness'),
      ] },
      { key: 'target_audience', label: { ta: 'இலக்கு பார்வையாளர் (பல தேர்வு)', en: 'Target audience (multi)' }, type: 'multiselect', options: [
        opt('families', 'குடும்பங்கள்', 'Families'),
        opt('youth', 'இளைஞர்கள்', 'Youth'),
        opt('women', 'பெண்கள்', 'Women'),
        opt('men', 'ஆண்கள்', 'Men'),
        opt('seniors', 'மூத்தவர்கள்', 'Seniors'),
        opt('professionals', 'தொழில்முறையினர்', 'Professionals'),
        opt('local', 'உள்ளூர்', 'Local'),
      ] },
      { key: 'contact_number', label: { ta: 'தொடர்பு எண்', en: 'Contact number' }, type: 'tel', placeholder: '+91 9XXXXXXXXX', required: true },
      // Real-estate conditional extras
      { key: 're_show_launch', label: { ta: 'லான்ச் / வெளியீடு தேதி காட்டவா?', en: 'Show launch/release date?' }, type: 'toggle', showIf: { key: 'category', equals: 'real_estate' } },
      { key: 're_launch_date', label: { ta: 'லான்ச் தேதி', en: 'Launch date' }, type: 'date', showIf: { key: 're_show_launch', equals: true } },
      { key: 're_show_approval', label: { ta: 'DTCP/RERA அனுமதி எண் காட்டவா?', en: 'Show approval number DTCP/RERA?' }, type: 'toggle', showIf: { key: 'category', equals: 'real_estate' } },
      { key: 're_approval_number', label: { ta: 'அனுமதி எண்', en: 'Approval number' }, type: 'text', showIf: { key: 're_show_approval', equals: true } },
      { key: 're_starting_price', label: { ta: 'தொடக்க விலை (விருப்பம்)', en: 'Starting price (optional)' }, type: 'number', showIf: { key: 'category', equals: 'real_estate' } },
    ],
  },
  {
    id: 2,
    title: { ta: 'படங்கள்', en: 'Images' },
    fields: [
      { key: 'image_source', label: { ta: 'பட மூலம்', en: 'Image source' }, type: 'radio', options: [
        opt('upload', 'பதிவேற்று', 'Upload'),
        opt('generate', 'உருவாக்கு', 'Generate'),
        opt('both', 'இரண்டும்', 'Both'),
      ] },
      { key: 'logo', label: { ta: 'லோகோ பதிவேற்று', en: 'Logo upload' }, type: 'image' },
      { key: 'base_images', label: { ta: 'அடிப்படை படங்கள் (பல)', en: 'Base images (multiple)' }, type: 'image', multiple: true },
      { key: 'gen_prompt', label: { ta: 'உரையிலிருந்து பட உருவாக்க ப்ராம்ப்ட்', en: 'Text-to-image prompt' }, type: 'textarea', showIf: { key: 'image_source', in: ['generate', 'both'] } },
      { key: 'gen_style', label: { ta: 'பட ஸ்டைல்', en: 'Image style' }, type: 'select', showIf: { key: 'image_source', in: ['generate', 'both'] }, options: [
        opt('photoreal', 'போட்டோ ரியல்', 'Photoreal'),
        opt('cinematic', 'சினிமாடிக்', 'Cinematic'),
        opt('illustration', 'இலஸ்ட்ரேஷன்', 'Illustration'),
        opt('3d_render', '3D ரெண்டர்', '3D render'),
        opt('watercolor', 'வாட்டர் கலர்', 'Watercolor'),
      ] },
      { key: 'gen_count', label: { ta: 'எண்ணிக்கை', en: 'Count' }, type: 'number', showIf: { key: 'image_source', in: ['generate', 'both'] } },
      { key: 'aspect_ratio', label: { ta: 'அளவு விகிதம்', en: 'Aspect ratio' }, type: 'ratio', options: [
        opt('9:16', '9:16', '9:16'),
        opt('1:1', '1:1', '1:1'),
        opt('16:9', '16:9', '16:9'),
        opt('4:5', '4:5', '4:5'),
      ] },
    ],
  },
  {
    id: 3,
    title: { ta: 'வீடியோ ஸ்டைல்', en: 'Video style' },
    fields: [
      { key: 'styles', label: { ta: 'ஸ்டைல்கள் (தேர்ந்தெடுக்கவும்)', en: 'Styles (select)' }, type: 'stylecheck', options: Object.entries(STYLE_PREVIEWS).map(([v, l]) => ({ value: v, label: l })) },
      { key: 'mood', label: { ta: 'மூட்', en: 'Mood' }, type: 'select', options: [
        opt('happy', 'மகிழ்ச்சி', 'Happy'),
        opt('premium', 'பிரீமியம்', 'Premium'),
        opt('emotional', 'உணர்வுப்பூர்வமான', 'Emotional'),
        opt('energetic', 'ஆற்றல் மிக்க', 'Energetic'),
        opt('calm', 'அமைதியான', 'Calm'),
        opt('festive', 'திருவிழா', 'Festive'),
      ] },
      { key: 'colour_palette', label: { ta: 'வண்ண பாலெட் (அல்லது லோகோ வண்ணங்கள்)', en: 'Colour palette (or logo colours)' }, type: 'text', placeholder: { ta: 'உதா: சிவப்பு + தங்கம்', en: 'e.g. red + gold' } },
      { key: 'pacing', label: { ta: 'வேகம்', en: 'Pacing' }, type: 'select', options: [
        opt('slow', 'மெதுவான', 'Slow'),
        opt('medium', 'நடுத்தர', 'Medium'),
        opt('fast', 'வேகமான', 'Fast'),
      ] },
    ],
  },
  {
    id: 4,
    title: { ta: 'கேரக்டர்', en: 'Character' },
    showIf: { key: 'styles', includes: 'character_speaking' },
    fields: [
      { key: 'speakers', label: { ta: 'யார் பேசுவார்', en: 'Who speaks' }, type: 'radio', options: [
        opt('man', 'ஆண்', 'Man'),
        opt('woman', 'பெண்', 'Woman'),
        opt('man_woman', 'ஆண் + பெண்', 'Man + Woman'),
        opt('family', 'குடும்பம்', 'Family'),
        opt('voice_only', 'குரல் மட்டும்', 'Voice only'),
      ] },
      { key: 'who_first', label: { ta: 'யார் முதலில் (ஜோடி)', en: 'Who speaks first (pair)' }, type: 'radio', showIf: { key: 'speakers', in: ['man_woman', 'family'] }, options: [
        opt('man', 'ஆண்', 'Man'),
        opt('woman', 'பெண்', 'Woman'),
      ] },
      { key: 'char_source', label: { ta: 'மூலம்', en: 'Source' }, type: 'radio', showIf: { key: 'speakers', notIn: ['voice_only'] }, options: [
        opt('ai', 'AI உருவாக்கம்', 'AI-generated'),
        opt('user_photo', 'யூசர் போட்டோ', 'User photo'),
        opt('shop_owner', 'கடை உரிமையாளர் போட்டோ', 'Shop-owner photo'),
      ] },
      { key: 'char_photo', label: { ta: 'போட்டோ பதிவேற்று', en: 'Photo upload' }, type: 'image', showIf: { key: 'char_source', in: ['user_photo', 'shop_owner'] } },
      { key: 'age_look', label: { ta: 'வயது தோற்றம்', en: 'Age look' }, type: 'text', showIf: { key: 'speakers', notIn: ['voice_only'] } },
      { key: 'outfit', label: { ta: 'உடை', en: 'Outfit' }, type: 'text', showIf: { key: 'speakers', notIn: ['voice_only'] } },
      { key: 'expression', label: { ta: 'எக்ஸ்பிரஷன்', en: 'Expression' }, type: 'text', showIf: { key: 'speakers', notIn: ['voice_only'] } },
      { key: 'gestures', label: { ta: 'சைகைகள்', en: 'Gestures' }, type: 'text', showIf: { key: 'speakers', notIn: ['voice_only'] } },
    ],
  },
  {
    id: 5,
    title: { ta: 'குரல் & இசை', en: 'Voice & music' },
    fields: [
      { key: 'voice_gender', label: { ta: 'குரல் பாலினம்', en: 'Voice gender' }, type: 'radio', options: [
        opt('male', 'ஆண்', 'Male'),
        opt('female', 'பெண்', 'Female'),
        opt('both', 'இரண்டும்', 'Both'),
      ] },
      { key: 'language', label: { ta: 'மொழி', en: 'Language' }, type: 'radio', options: [
        opt('tamil', 'தமிழ்', 'Tamil'),
        opt('english', 'ஆங்கிலம்', 'English'),
        opt('mix', 'தமிழ்-ஆங்கிலம்', 'Tamil-English mix'),
      ] },
      { key: 'dialect', label: { ta: 'வழக்கு (பீட்டா)', en: 'Dialect (beta)' }, type: 'select', options: [
        opt('standard', 'ஸ்டாண்டர்ட்', 'Standard'),
        opt('chennai', 'சென்னை', 'Chennai'),
        opt('kongu', 'கொங்கு', 'Kongu'),
        opt('madurai', 'மதுரை', 'Madurai'),
        opt('tirunelveli', 'திருநெல்வேலி', 'Tirunelveli'),
      ] },
      { key: 'tone', label: { ta: 'டோன்', en: 'Tone' }, type: 'select', options: [
        opt('friendly', 'நட்பு', 'Friendly'),
        opt('professional', 'தொழில்முறை', 'Professional'),
        opt('warm', 'அன்பான', 'Warm'),
        opt('energetic', 'ஆற்றல்', 'Energetic'),
        opt('authoritative', 'அதிகாரப்பூர்வ', 'Authoritative'),
      ] },
      { key: 'speed', label: { ta: 'வேகம்', en: 'Speed' }, type: 'select', options: [
        opt('slow', 'மெதுவான', 'Slow'),
        opt('normal', 'சாதாரண', 'Normal'),
        opt('fast', 'வேகமான', 'Fast'),
      ] },
      { key: 'music_style', label: { ta: 'பின்னணி இசை', en: 'Background music' }, type: 'select', options: [
        opt('none', 'இல்லை', 'None'),
        opt('cinematic', 'சினிமாடிக்', 'Cinematic'),
        opt('upbeat', 'அப்பீட்', 'Upbeat'),
        opt('traditional', 'பாரம்பரிய', 'Traditional'),
        opt('corporate', 'கார்ப்பரேட்', 'Corporate'),
        opt('lofi', 'லோ-ஃபை', 'Lo-fi'),
      ] },
    ],
  },
  {
    id: 6,
    title: { ta: 'டயலாக் உறுதிப்படுத்தல்', en: 'Dialogue confirmation' },
    type: 'dialogue',
    fields: [],
  },
  {
    id: 7,
    title: { ta: 'காட்சி & இடம்', en: 'Scene & location' },
    fields: [
      { key: 'setting', label: { ta: 'அமைப்பு', en: 'Setting' }, type: 'select', options: [
        opt('home', 'வீட்டுக்குள்', 'Inside home'),
        opt('road', 'ரோட்டில் நடப்பது', 'Walking on road'),
        opt('car_exit', 'காரிலிருந்து இறங்குதல்', 'Stepping out of car'),
        opt('car_inside', 'காருக்குள் பேசுதல்', 'Talking inside car'),
        opt('showroom', 'ஷோரூம் / கடை', 'Showroom/shop'),
        opt('office', 'ஆபீஸ்', 'Office'),
        opt('plot', 'பிளாட் / சைட்', 'Plot/site'),
        opt('temple', 'கோயில் / திருவிழா', 'Temple/festival'),
        opt('ai_decide', 'AI முடிவு செய்யட்டும்', 'Let AI decide'),
      ] },
      { key: 'time_of_day', label: { ta: 'நாள் நேரம்', en: 'Time of day' }, type: 'select', options: [
        opt('day', 'பகல்', 'Day'),
        opt('night', 'இரவு', 'Night'),
        opt('sunset', 'சூரிய அஸ்தமனம்', 'Sunset'),
        opt('morning', 'காலை', 'Morning'),
        opt('festive', 'திருவிழா', 'Festive'),
      ] },
      { key: 'festival_season', label: { ta: 'திருவிழா / பருவம்', en: 'Festival/season' }, type: 'text' },
      { key: 'camera_shots', label: { ta: 'கேமரா கோணங்கள் (பல)', en: 'Camera shots (multi)' }, type: 'multiselect', options: [
        opt('wide', 'வைட்', 'Wide'),
        opt('closeup', 'க்ளோஸ்அப்', 'Close-up'),
        opt('drone', 'ட்ரோன்', 'Drone'),
        opt('tracking', 'ட்ராக்கிங்', 'Tracking'),
        opt('handheld', 'ஹேண்ட்ஹெல்டு', 'Handheld'),
        opt('pan', 'பேன்', 'Pan'),
      ] },
      { key: 'phone_call_scene', label: { ta: 'போன் கால் காட்சி?', en: 'Phone-call scene?' }, type: 'toggle' },
      { key: 'crowd', label: { ta: 'பின்னணி', en: 'Background' }, type: 'radio', options: [
        opt('crowd', 'கூட்டம்', 'Crowd'),
        opt('clean', 'சுத்தமான', 'Clean'),
      ] },
      { key: 'address_display', label: { ta: 'முகவரி காட்சி', en: 'Address display' }, type: 'select', options: [
        opt('cg_map', 'CG அனிமேட்டட் மேப்', 'CG animated map'),
        opt('onscreen_text', 'ஸ்க்ரீன் டெக்ஸ்ட்', 'On-screen text'),
        opt('spoken_phone', 'போன் காலில் பேசுதல்', 'Spoken on phone call'),
        opt('signboard', 'கடை பலகை', 'Shop signboard'),
        opt('none', 'இல்லை', 'None'),
      ] },
      { key: 'address_text', label: { ta: 'முகவரி உரை', en: 'Address text' }, type: 'textarea' },
    ],
  },
  {
    id: 8,
    title: { ta: 'ஸ்க்ரீன் டெக்ஸ்ட் FX', en: 'On-screen text FX' },
    fields: [
      { key: 'text_on', label: { ta: 'டெக்ஸ்ட் ஆன்/ஆஃப்', en: 'Text on/off' }, type: 'toggle' },
      { key: 'text_style', label: { ta: 'ஸ்டைல்', en: 'Style' }, type: 'select', showIf: { key: 'text_on', equals: true }, options: [
        opt('bold', 'போல்டு', 'Bold'),
        opt('gold', 'கோல்டு', 'Gold'),
        opt('light', 'லைட்/தின்', 'Light/thin'),
        opt('icon', 'ஐகான்', 'Icon'),
        opt('ae_cg', 'After-Effects CG', 'After-Effects CG'),
        opt('3d', '3D', '3D'),
      ] },
      { key: 'font_mood', label: { ta: 'ஃபான்ட் மூட்', en: 'Font mood' }, type: 'select', showIf: { key: 'text_on', equals: true }, options: [
        opt('modern', 'மாடர்ன்', 'Modern'),
        opt('traditional', 'பாரம்பரிய', 'Traditional'),
        opt('playful', 'விளையாட்டுத்தனமான', 'Playful'),
        opt('elegant', 'எலிகன்ட்', 'Elegant'),
      ] },
      { key: 'text_position', label: { ta: 'நிலை', en: 'Position' }, type: 'select', showIf: { key: 'text_on', equals: true }, options: [
        opt('top', 'மேல்', 'Top'),
        opt('center', 'மையம்', 'Center'),
        opt('bottom', 'கீழ்', 'Bottom'),
        opt('lower_third', 'லோயர் திர்டு', 'Lower third'),
      ] },
      { key: 'text_animation', label: { ta: 'அனிமேஷன்', en: 'Animation' }, type: 'select', showIf: { key: 'text_on', equals: true }, options: [
        opt('fade', 'ஃபேட்', 'Fade'),
        opt('slide', 'ஸ்லைடு', 'Slide'),
        opt('pop', 'பாப்', 'Pop'),
        opt('typewriter', 'டைப் ரைட்டர்', 'Typewriter'),
        opt('none', 'இல்லை', 'None'),
      ] },
      { key: 'offer_badge', label: { ta: 'ஆஃபர் பேட்ஜ் வடிவம்', en: 'Offer badge shape' }, type: 'select', showIf: { key: 'text_on', equals: true }, options: [
        opt('none', 'இல்லை', 'None'),
        opt('circle', 'வட்டம்', 'Circle'),
        opt('ribbon', 'ரிப்பன்', 'Ribbon'),
        opt('star', 'நட்சத்திரம்', 'Star'),
        opt('pill', 'பில்', 'Pill'),
      ] },
      { key: 'captions', label: { ta: 'கேப்ஷன்ஸ்?', en: 'Captions?' }, type: 'toggle' },
    ],
  },
  {
    id: 9,
    title: { ta: 'கால அளவு & எண்ட் கார்டு', en: 'Duration & end card' },
    fields: [
      { key: 'duration', label: { ta: 'கால அளவு', en: 'Duration' }, type: 'radio', options: [
        opt('10', '10 வி', '10s'),
        opt('30', '30 வி', '30s'),
        opt('60', '60 வி', '60s'),
      ] },
      { key: 'endcard_on', label: { ta: 'எண்ட் கார்டு ஆன்/ஆஃப்', en: 'End card on/off' }, type: 'toggle' },
      { key: 'endcard_image', label: { ta: 'எண்ட் கார்டு படம் (கட்டிடம்/கடை)', en: 'End card image (building/shop)' }, type: 'image', showIf: { key: 'endcard_on', equals: true } },
      { key: 'endcard_layout', label: { ta: 'லேஅவுட்', en: 'Layout' }, type: 'select', showIf: { key: 'endcard_on', equals: true }, options: [
        opt('logo_phone', 'லோகோ + போன்', 'Logo + phone'),
        opt('logo_address_map', 'லோகோ + முகவரி + மேப்', 'Logo + address + map'),
        opt('whatsapp_qr_phone', 'WhatsApp QR + போன்', 'WhatsApp QR + phone'),
        opt('offer_phone', 'ஆஃபர் + போன்', 'Offer + phone'),
      ] },
      { key: 'endcard_animation', label: { ta: 'அனிமேஷன்', en: 'Animation' }, type: 'select', showIf: { key: 'endcard_on', equals: true }, options: [
        opt('fade', 'ஃபேட்', 'Fade'),
        opt('slide', 'ஸ்லைடு', 'Slide'),
        opt('zoom', 'ஜூம்', 'Zoom'),
        opt('none', 'இல்லை', 'None'),
      ] },
      { key: 'endcard_length', label: { ta: 'நீளம் (3-5s)', en: 'Length (3-5s)' }, type: 'number', showIf: { key: 'endcard_on', equals: true } },
      { key: 'whatsapp_number', label: { ta: 'WhatsApp எண்', en: 'WhatsApp number' }, type: 'tel', showIf: { key: 'endcard_on', equals: true } },
      { key: 'website', label: { ta: 'வலைத்தளம்', en: 'Website' }, type: 'text', showIf: { key: 'endcard_on', equals: true } },
    ],
  },
  {
    id: 10,
    title: { ta: 'தொடர்ச்சி லாக்', en: 'Continuity lock' },
    fields: [
      { key: 'locks', label: { ta: 'லாக் பட்டியல்', en: 'Lock list' }, type: 'multiselect', options: [
        opt('face', 'முகம்', 'Face'),
        opt('outfit', 'உடை', 'Outfit'),
        opt('location', 'இடம்', 'Location'),
        opt('palette', 'வண்ண பாலெட்', 'Colour palette'),
        opt('lighting', 'லைட்டிங் / நேரம்', 'Lighting/time'),
        opt('voice', 'குரல்', 'Voice'),
        opt('product', 'ப்ராடக்ட் லுக்', 'Product look'),
        opt('logo_text', 'லோகோ / டெக்ஸ்ட் இன் போஸ்ட்', 'Logo/text-in-post'),
      ] },
      { key: 'lock_method', label: { ta: 'முறை', en: 'Method' }, type: 'radio', options: [
        opt('sheet_lastframe', 'கேரக்டர் ஷீட் + லாஸ்ட் ஃப்ரேம் செயினிங்', 'Character sheet + last-frame chaining'),
        opt('sheet_only', 'கேரக்டர் ஷீட் மட்டும்', 'Character sheet only'),
        opt('none', 'இல்லை', 'None'),
      ] },
      { key: 'strictness', label: { ta: 'கடுமை', en: 'Strictness' }, type: 'radio', options: [
        opt('standard', 'ஸ்டாண்டர்ட்', 'Standard'),
        opt('high', 'உயர்', 'High'),
        opt('maximum', 'அதிகபட்சம்', 'Maximum'),
      ] },
      { key: 'require_approval', label: { ta: 'முழு ரெண்டருக்கு முன் கேரக்டர் ஷீட் ஒப்புதல்?', en: 'Require approval of character sheet before full render?' }, type: 'toggle' },
    ],
  },
  {
    id: 11,
    title: { ta: 'மறுபார்வை & உருவாக்கு', en: 'Review & generate' },
    type: 'review',
    fields: [],
  },
];

function stepById(id) {
  return steps.find((s) => s.id === id);
}

// AI voice recommendation (used client-side for the hint + server-side in prompt).
function recommendVoice(answers) {
  const cat = answers.category;
  const audience = answers.target_audience || [];
  const concept = (answers.ad_concept || '').toLowerCase();
  let gender = 'female';
  let reason = { ta: 'பொதுவான பரிந்துரை.', en: 'General recommendation.' };
  if (cat === 'real_estate' || cat === 'clinic' || cat === 'education') {
    gender = 'male';
    reason = { ta: 'நம்பகத்தன்மைக்கு ஆண் குரல் பொருத்தமானது.', en: 'Male voice suits trust-based categories.' };
  } else if (cat === 'jewellery' || cat === 'textile' || cat === 'salon') {
    gender = 'female';
    reason = { ta: 'அழகியல் பிரிவுகளுக்கு பெண் குரல் பொருத்தமானது.', en: 'Female voice suits beauty/lifestyle categories.' };
  } else if (cat === 'restaurant') {
    gender = 'both';
    reason = { ta: 'உணவு விளம்பரத்திற்கு ஆண்+பெண் ஜோடி நன்றாக இருக்கும்.', en: 'Food ads work well with a male+female pair.' };
  }
  if (audience.includes('youth') && gender === 'female') {
    reason = { ta: 'இளைஞர்களை ஈர்க்க பெண் குரல் சிறந்தது.', en: 'Youth audience responds well to a female voice.' };
  }
  return { gender, reason };
}

module.exports = { steps, stepById, CATEGORIES, SUBTYPES, STYLE_PREVIEWS, recommendVoice, opt };
