Ext.define('CustomApp', {
    extend: 'Rally.app.TimeboxScopedApp',
    componentCls: 'app',
    scopeType: 'iteration',
    _allowedScheduleStates:[],
    _allowedStates:[],
    comboboxConfig: {
        fieldLabel: 'Select iteration:',
        labelWidth: 100,
        width: 300
    },
    onScopeChange: function() {
        this._getDefectModel().then({
            success: this._getScheduleStateAllowedValues,
            scope:this
        }).then({
            success: this._getTaskModel,
            scope:this
        }).then ({
            success: this._getStateAllowedValues,
            scope:this
        }).then({
            success:this._makeStore,
            scope:this
         });
    },
    
    _getDefectModel:function(){
        return Rally.data.ModelFactory.getModel({
            type:'Defect'
        });
    },
    
    _getTaskModel:function(allowedScheduleStates){
        this._allowedScheduleStates = allowedScheduleStates;
        console.log(this._allowedScheduleStates);
        return Rally.data.ModelFactory.getModel({
            type:'Task'
        });
    },
    
    _getScheduleStateAllowedValues:function(model){
        var deferred = Ext.create('Deft.Deferred');
        var allowedScheduleStateValues = [];
        model.getField('ScheduleState').getAllowedValueStore().load({
            callback: function(records,operation,success){
                Ext.Array.each(records,function(allowedValue){
                    allowedScheduleStateValues.push(allowedValue.get('StringValue'));
                });
                if(success){
                    deferred.resolve(allowedScheduleStateValues);
                }
                else{
                    deferred.reject();
                }

            }
        }) ;
        return deferred.promise;
        
    },
    
    _getStateAllowedValues:function(model){
        var deferred = Ext.create('Deft.Deferred');
        var allowedStateValues = [];
        model.getField('State').getAllowedValueStore().load({
            callback: function(records,operation,success){
                Ext.Array.each(records,function(allowedValue){
                    allowedStateValues.push(allowedValue.get('StringValue'));
                });
                if(success){
                    deferred.resolve(allowedStateValues);
                }
                else{
                    deferred.reject();
                }

            }
        }) ;
        return deferred.promise;
        
    },
    
    _makeStore:function(allowedStates){
        this._allowedStates = allowedStates;
        console.log(this._allowedStates);
        Ext.create('Rally.data.wsapi.Store', {
                model: 'Task',
                fetch: ['ObjectID', 'FormattedID', 'Name', 'State', 'Owner', 'WorkProduct', 'Estimate', 'Actuals', 'TimeSpent','Blocked','Project','ScheduleState'],
                autoLoad: true,
                filters: this.getContext().getTimeboxScope().getQueryFilter(),
                listeners: {
                    load: this._onDataLoaded,
                    scope: this
                }
        });
    },
    _onDataLoaded: function(store, records){
        if (records.length === 0) {
            this._notifyNoTasks();
        }
        
        else{
            if (this._notifier) {
                this._notifier.destroy();
            }
            var that = this;
            var promises = [];
            _.each(records, function(task) {
                promises.push(that._getWorkproduct(task, that));
            });

            Deft.Promise.all(promises).then({
                success: function(results) {
                    console.log('results', results);
                    that._tasks = results;
                    that._makeGrid();
                }
            });
        }
        
    },
    _getWorkproduct: function(task, scope) {
        console.log('task', task);
        var that = scope;
        var deferred = Ext.create('Deft.Deferred');
        var artifactOid = task.get('WorkProduct').ObjectID;
        var artifactType = task.get('WorkProduct')._type;
        console.log('artifactType', artifactType);
        Rally.data.ModelFactory.getModel({
            type: artifactType,
            scope: this,
            success: function(model, operation) {
                model.load(artifactOid,{
                    scope: this,
                    success: function(record, operation) {
                        var artifactState = record.get('ScheduleState');
                        var artifactFid = record.get('FormattedID');
                        var taskRef     = task.get('_ref');
                        var taskOid     = task.get('ObjectID');
                        var taskFid     = task.get('FormattedID');
                        var taskEstimate = task.get('Estimate');
                        var taskActuals = task.get('Actuals');
                        //var taskTimespent = task.get('TimeSpent');
                        var taskName    = task.get('Name');
                        var blocked     = task.get('Blocked');
                        var taskState   = task.get('State');
                        var taskOwner       = (task.get('Owner')) ? task.get('Owner')._refObjectName : "None";
                        var workproduct = task.get('WorkProduct');
                        
                        result = {
                                    "_ref"          : taskRef,
                                    "ObjectID"      : taskOid,
                                    "FormattedID"   : taskFid,
                                    "Name"          : taskName,
                                    "Estimate"      : taskEstimate,
                                    "Actuals"       : taskActuals,
                                    //"TimeSpent"     : taskTimespent,
                                    "State"         : taskState,
                                    "Blocked"       : blocked,
                                    "WorkProduct"   : workproduct,
                                    "ScheduleState" : artifactState,
                                    "Owner"         : taskOwner,
                                    "WorkproductID" : artifactFid
                                };
                        deferred.resolve(result);    
                    }
                });
            }
        });
        return deferred;
    },
    _makeGrid: function() {
        var that = this;
        console.log(that._tasks);
        if (that._grid) {
            that._grid.destroy();
        }
        var gridStore = Ext.create('Rally.data.custom.Store', {
            data: that._tasks,
            groupField: 'WorkproductID',
            limit: Infinity
        });
        that._grid = Ext.create('Rally.ui.grid.Grid', {
            itemId: 'taskGrid',
            store: gridStore,
            features: [{ftype:'groupingsummary'}],
            //enableBlockedReasonPopover: false,
            minHeight: 500,
            columnCfgs: [
                {
                    text: 'Formatted ID', dataIndex: 'FormattedID', xtype: 'templatecolumn',
                    tpl: Ext.create('Rally.ui.renderer.template.FormattedIDTemplate')
                },

                {
                    text: 'Name', dataIndex: 'Name',
                    summaryRenderer: function() {
                        return "Totals"; 
                    }
                },
                {
                    text: 'Estimate', dataIndex: 'Estimate',
                    summaryType: 'sum'
                },
                {
                    text: 'Actuals', dataIndex: 'Actuals',
                    summaryType: 'sum'
                },
                //{
                //    text: 'TimeSpent', dataIndex: 'TimeSpent',
                //    summaryType: 'sum'
                //},
                {
                    text: 'Task State', dataIndex: 'State',xtype: 'templatecolumn',
                        tpl: Ext.create('Rally.ui.renderer.template.ScheduleStateTemplate',
                            {
                                states: that._allowedStates,
                                field: {
                                    name: 'State' 
                                }
                        })
                },
                {
                    text: 'Blocked', dataIndex: 'Blocked'
                },
                {
                    text: 'Task Owner', dataIndex: 'Owner'
                },
                {
                    text: 'WorkProduct', dataIndex: 'WorkProduct',
                    renderer: function(val, meta, record) {
                        return '<a href="' + Rally.nav.Manager.getDetailUrl(record.get('WorkProduct')) + '">' + record.get('WorkProduct').FormattedID + '</a>';
                    }
                },
                {
                    text: 'ScheduleState', dataIndex: 'ScheduleState',xtype: 'templatecolumn',
                        tpl: Ext.create('Rally.ui.renderer.template.ScheduleStateTemplate',
                            {
                                states: that._allowedScheduleStates,
                                field: {
                                    name: 'ScheduleState' 
                                }
                        })
                }
            ]
        });
        that.add(that._grid);
        that._grid.reconfigure(gridStore);
    },
    _notifyNoTasks: function() {
        if (this._grid) {
            this._grid.destroy();
        }
        if (this._notifier) {
            this._notifier.destroy();
        }
        this._notifier =  Ext.create('Ext.Container',{
                xtype: 'container',
                itemId: 'notifyContainer',
                html: "No Tasks found that match selection."
            });
        this.add( this._notifier);  
    }
});
