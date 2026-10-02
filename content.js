// Content is editable JSON. The renderer should not contain course prose.
async function read(name) {
  const response=await fetch(new URL(name,import.meta.url));
  if(!response.ok)throw Error('课程文件读取失败：'+name);
  return response.json();
}
const [curriculum,bibliography]=await Promise.all([read('./curriculum.json'),read('./sources.json')]);
export const revision=curriculum.revision;
export const currentLessonId=curriculum.currentLessonId;
export const publishedLessonIds=curriculum.lessons.filter(l=>l.published).map(l=>l.id);
export const sources=bibliography.sources;
export const stages=curriculum.stages;
export const lessons=await Promise.all(curriculum.lessons.map(async l=>l.published?{...l,...await read('./courses/'+l.id+'.json')}:l));
