module.exports = function(grunt) {

    grunt.initConfig({
        credentials: grunt.file.readJSON('credentials/config.json'),

        sshexec: {
            deploy: {
                command: '<%= credentials.command %>',
                options: {
                    host: '<%= credentials.host %>',
                    port: '<%= credentials.port %>',
                    username: '<%= credentials.username %>',
                    privateKey: grunt.file.read('credentials/id_rsa'),
                }
            }
        }
    });

    grunt.registerTask('default', [
        'sshexec'
    ]);

    grunt.loadNpmTasks('grunt-ssh');
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);
}