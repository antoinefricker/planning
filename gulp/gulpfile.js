 
const gulp = require('gulp');
const browserSync = require('browser-sync').create();
const fs = require('fs');
const yaml = require('js-yaml');
const log = require('gulplog');
const gulpif = require('gulp-if');
const rename = require('gulp-rename');
const sass = require('gulp-sass');
const autoprefixer = require('gulp-autoprefixer');
const csso = require('gulp-csso');
const concat = require('gulp-concat');
const uglify = require('gulp-uglify');
const sourcemaps = require('gulp-sourcemaps');



// ---------------------------------- CORE + READ CONFIG


const { ENV, CONFIG } = yaml.safeLoad(fs.readFileSync('gulpconfig.yaml', 'utf8'));

gulp.task('empty-task', (done) => {
    done();
});


// ---------------------------------- BROWSER SYNC

gulp.task('browserSync_reload', (done) => {
    console.log('browserSync_reload');
    browserSync.reload();
    done();
});




// ---------------------------------- ASSETS

gulp.task('assets-task', function(){
    return gulp.src(CONFIG.assets.watch)
        .pipe(gulp.dest(CONFIG.path.dest + CONFIG.assets.dest));
});




// ---------------------------------- SASS

function sassCreateTask(name, entryFile, includePaths, targetFolder){
    let sassTaskName = 'sass:' + name;
    let targetPath = CONFIG.path.dest + targetFolder;

    gulp.task(sassTaskName, () => {

        return gulp.src(entryFile)
            .pipe(sass({ includePaths: includePaths })
                .on('error', sass.logError))
            // .pipe(autoprefixer(CONFIG.sass.autoprefixer))
            // .pipe(csso(CONFIG.sass.csso))
            .pipe(rename((path) => {
                path.basename = name + '.min';
            }))
            .pipe(sourcemaps.write(''))
            .pipe(gulp.dest(targetPath))
            .pipe(browserSync.stream());  
            ;   
    }); 
    return sassTaskName;
}
function sassInitTasks(){
    let sassTasks = [];
    
    CONFIG.sass.themes.forEach((theme) => {

        if(theme.enabled === false)
            return;
        
        // theme's main appearance
        sassTasks.push(sassCreateTask(
            theme.name, 
            theme.entry,
            theme.includePaths,
            theme.target
        ));
        if(theme.modules){
            theme.modules.forEach((module) => {

                if(module.enabled === false)
                    return;

                sassTasks.push(sassCreateTask( 
                    theme.name + '-' + module.name, 
                    module.entry,
                    theme.includePaths,
                    theme.target
                ));
            });
        }
        
        // create theme's skins
        if(theme.skins){
            theme.skins.forEach((skin) => {

                if(skin.enabled === false)
                    return;

                sassTasks.push(sassCreateTask(
                    skin.name + '__' + theme.name, 
                    theme.entry,
                    skin.includePaths,
                    theme.target
                ));
                if(theme.modules){
                    theme.modules.forEach((module) => {

                        if(module.enabled === false)
                            return;

                        sassTasks.push(sassCreateTask(
                            skin.name + '__' + theme.name + '-' + module.name, 
                            module.entry,
                            skin.includePaths,
                            theme.target
                        ));
                    }); 
                }
            });
        }                              
    });
    
    console.log('sassInitTasks (' + sassTasks.length + ' targets)');
    return sassTasks;
}




// ---------------------------------- JS

function jsCreateTask(name, sources, into){
    
    let jsTaskName = 'js:' + name; 
    let targetPath = CONFIG.path.dest + CONFIG.js.target;

    gulp.task(jsTaskName, () => {
        return gulp.src(sources)
            .pipe(concat(into))
			   .pipe(gulp.dest(targetPath + '/sources'))
			   .pipe(sourcemaps.init({ loadMaps: true }))
			   .pipe(uglify())
			   .pipe(sourcemaps.write('map'))
            .pipe(gulp.dest(targetPath));
        }); 
    return jsTaskName;
}
function jsInitTasks(){
    let jsTasks = []; 
    
     CONFIG.js.files.forEach(file => {
        if(file.enabled === false)
            return;
         jsTasks.push(jsCreateTask(file.name, file.concat, file.into));
     });

    console.log('jsInitTasks (' + jsTasks.length + ' targets)');
    return jsTasks;
}




let tasks;

tasks = sassInitTasks();
gulp.task('sass-build', gulp.series.apply(null, (tasks.length > 0) ? tasks : ['empty-task']));

tasks = jsInitTasks();
gulp.task('js-build', gulp.series.apply(null, (tasks.length > 0) ? tasks : ['empty-task']));


gulp.task('init', (done) => {
    browserSync.init(CONFIG.browserSync);

    gulp.watch(CONFIG.js.watch, gulp.series('js-build', 'browserSync_reload'));
    gulp.watch(CONFIG.sass.watch, gulp.series('sass-build'));
    gulp.watch(CONFIG.assets.watch, gulp.series('assets-task' ,'browserSync_reload')); 
    
    done();
});

gulp.task('default', gulp.series(
    'init',
    'assets-task',
    'js-build',
    'sass-build',
    'browserSync_reload'
    )); 

